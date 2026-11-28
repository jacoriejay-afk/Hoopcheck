-- Disposable PG17 candidate only. No hosted schema changes.
begin;
create table play_billing_candidate.notification_jobs(
 subscription text not null check(length(subscription)<=320 and subscription ~ '^projects/[a-z][a-z0-9-]{4,62}/subscriptions/[A-Za-z][A-Za-z0-9._~-]{2,254}$'),
 message_id text not null check(message_id ~ '^[0-9]{1,64}$'),
 fingerprint text not null check(fingerprint ~ '^[0-9a-f]{64}$'),
 received_at timestamptz not null default clock_timestamp(),
 ready_at timestamptz not null default clock_timestamp(),
 status text not null default 'queued' check(status in ('queued','leased','done','dead')),
 attempts integer not null default 0 check(attempts between 0 and 5),
 lease_id uuid,
 lease_until timestamptz,
 primary key(subscription,message_id),
 check((status='leased')=(lease_id is not null and lease_until is not null)),
 check((lease_id is null)=(lease_until is null))
);
create index play_notifications_ready on play_billing_candidate.notification_jobs(status,ready_at,lease_until);
alter table play_billing_candidate.notification_jobs enable row level security;
alter table play_billing_candidate.notification_jobs force row level security;
revoke all on play_billing_candidate.notification_jobs from public,anon,authenticated,service_role;
grant select,insert on play_billing_candidate.notification_jobs to service_role;
grant update(ready_at,status,attempts,lease_id,lease_until) on play_billing_candidate.notification_jobs to service_role;
create policy notification_read on play_billing_candidate.notification_jobs for select to service_role using(true);
create policy notification_insert on play_billing_candidate.notification_jobs for insert to service_role with check(true);
create policy notification_update on play_billing_candidate.notification_jobs for update to service_role using(true) with check(true);
-- Only authenticated, parsed pushes reach this function. No raw token or payload.
create function play_billing_candidate.enqueue_test_notification(p_subscription text,p_message text,p_fingerprint text)
returns text language plpgsql volatile security invoker set search_path='' as $body$
declare inserted integer; existing text;
begin
 insert into play_billing_candidate.notification_jobs(subscription,message_id,fingerprint)
 values(p_subscription,p_message,p_fingerprint) on conflict(subscription,message_id) do nothing;
 get diagnostics inserted=row_count;
 if inserted=1 then return 'queued'; end if;
 select fingerprint into existing from play_billing_candidate.notification_jobs where subscription=p_subscription and message_id=p_message;
 if existing=p_fingerprint then return 'duplicate'; end if;
 return 'conflict';
end
$body$;
create function play_billing_candidate.lease_test_notification()
returns table(subscription text,message_id text,fingerprint text,lease_id uuid)
language plpgsql volatile security invoker set search_path='' as $body$
begin
 update play_billing_candidate.notification_jobs j set status='dead',lease_id=null,lease_until=null
 where j.status='leased' and j.lease_until<=clock_timestamp() and j.attempts>=5;
 return query
 with chosen as(
  select j.subscription,j.message_id from play_billing_candidate.notification_jobs j
  where j.attempts<5 and ((j.status='queued' and j.ready_at<=clock_timestamp()) or (j.status='leased' and j.lease_until<=clock_timestamp()))
  order by j.ready_at,j.received_at,j.subscription,j.message_id
  for update skip locked limit 1
 )
 update play_billing_candidate.notification_jobs j set status='leased',attempts=j.attempts+1,lease_id=gen_random_uuid(),lease_until=clock_timestamp()+interval '90 seconds'
 from chosen c where j.subscription=c.subscription and j.message_id=c.message_id
 returning j.subscription,j.message_id,j.fingerprint,j.lease_id;
end
$body$;
create function play_billing_candidate.finish_test_notification(p_subscription text,p_message text,p_lease uuid,p_success boolean)
returns boolean language plpgsql volatile security invoker set search_path='' as $body$
declare affected integer;
begin
 if p_success is null then return false; end if;
 update play_billing_candidate.notification_jobs j
 set status=case when p_success then 'done' when attempts>=5 then 'dead' else 'queued' end,
 ready_at=clock_timestamp()+make_interval(secs=>30*attempts),lease_id=null,lease_until=null
 where j.subscription=p_subscription and j.message_id=p_message and j.lease_id=p_lease and j.status='leased' and j.lease_until>clock_timestamp();
 get diagnostics affected=row_count;return affected=1;
end
$body$;
revoke all on function play_billing_candidate.enqueue_test_notification(text,text,text),play_billing_candidate.lease_test_notification(),play_billing_candidate.finish_test_notification(text,text,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function play_billing_candidate.enqueue_test_notification(text,text,text),play_billing_candidate.lease_test_notification(),play_billing_candidate.finish_test_notification(text,text,uuid,boolean) to service_role;
commit;
