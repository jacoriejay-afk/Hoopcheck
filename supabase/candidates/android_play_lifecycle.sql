-- Candidate ONLY, after android_play_purchase_ledger.sql in disposable PG17.
-- Never apply to a hosted DB; never join this projection to real entitlements.
begin;
create table play_billing_candidate.purchase_observations (
 environment text not null check(environment='test'),
 package_name text not null check(package_name='online.hoopcheck.app'),
 fingerprint text not null,
 generation bigint not null check(generation>0),
 completed_generation bigint not null default 0 check(completed_generation>=0 and completed_generation<=generation),
 started_at timestamptz not null,
 checked_at timestamptz,
 state text not null check(state in ('unavailable','inactive','pending_ack','eligible_for_reconciliation')),
 expires_at timestamptz,
 primary key(environment,package_name,fingerprint),
 foreign key(environment,package_name,fingerprint)
  references play_billing_candidate.purchase_claims(environment,package_name,fingerprint),
 check((state in ('pending_ack','eligible_for_reconciliation'))=(expires_at is not null)),
 check((checked_at is null)=(completed_generation<generation))
);
alter table play_billing_candidate.purchase_observations enable row level security;
alter table play_billing_candidate.purchase_observations force row level security;
revoke all on play_billing_candidate.purchase_observations from public,anon,authenticated,service_role;
grant select,insert on play_billing_candidate.purchase_observations to service_role;
grant update(generation,completed_generation,started_at,checked_at,state,expires_at)
 on play_billing_candidate.purchase_observations to service_role;
create policy service_read on play_billing_candidate.purchase_observations for select to service_role using(true);
create policy service_insert on play_billing_candidate.purchase_observations for insert to service_role with check(environment='test');
create policy service_update on play_billing_candidate.purchase_observations for update to service_role using(environment='test') with check(environment='test');

-- Caller verifies owner/session/deletion state and rate limits independently.
-- A refresh start invalidates prior evidence and supersedes earlier work.
create function play_billing_candidate.begin_test_refresh(p_fingerprint text,p_owner uuid)
returns bigint language plpgsql volatile security invoker set search_path='' as $body$
declare next_generation bigint;
begin
 insert into play_billing_candidate.purchase_observations as o(environment,package_name,fingerprint,generation,started_at,state)
 select c.environment,c.package_name,c.fingerprint,1,clock_timestamp(),'unavailable'
 from play_billing_candidate.purchase_claims c
 where c.environment='test' and c.package_name='online.hoopcheck.app' and c.fingerprint=p_fingerprint and c.owner_id=p_owner
 on conflict(environment,package_name,fingerprint) do update set
 generation=o.generation+1,started_at=clock_timestamp(),checked_at=null,state='unavailable',expires_at=null
 returning generation into next_generation;
 return next_generation;
end
$body$;
-- Only trusted verification results may be supplied. Unknown, unsupported or
-- failed provider responses map to unavailable, never to paid access.
create function play_billing_candidate.finish_test_refresh(
 p_fingerprint text,p_owner uuid,p_generation bigint,p_state text,p_expires_at timestamptz
) returns boolean language plpgsql volatile security invoker set search_path='' as $body$
declare affected integer;
begin
 if p_generation is null or p_generation<=0 or p_state is null or
 p_state not in ('unavailable','inactive','pending_ack','eligible_for_reconciliation') then return false; end if;
 if p_state in ('pending_ack','eligible_for_reconciliation') then
  if p_expires_at is null or not isfinite(p_expires_at) or p_expires_at<=clock_timestamp() then return false; end if;
 elsif p_expires_at is not null then return false;
 end if;
 update play_billing_candidate.purchase_observations o
 set completed_generation=p_generation,checked_at=clock_timestamp(),state=p_state,expires_at=p_expires_at
 from play_billing_candidate.purchase_claims c
 where c.environment=o.environment and c.package_name=o.package_name and c.fingerprint=o.fingerprint
 and c.owner_id=p_owner and o.environment='test' and o.package_name='online.hoopcheck.app'
 and o.fingerprint=p_fingerprint and o.generation=p_generation and o.completed_generation<p_generation
 and o.started_at>=clock_timestamp()-interval '60 seconds';
 get diagnostics affected=row_count;
 return affected=1;
end
$body$;
-- Advisory test projection only. Unknown/missing/in-flight/stale are unavailable;
-- expired access remains inactive regardless of the last provider response.
create function play_billing_candidate.read_test_observation(p_fingerprint text,p_owner uuid)
returns text language sql volatile security invoker set search_path='' as $body$
 select coalesce((
 select case
  when o.completed_generation<>o.generation or o.checked_at is null
   or o.checked_at>clock_timestamp() or o.checked_at<clock_timestamp()-interval '30 minutes' then 'unavailable'
  when o.expires_at is not null and o.expires_at<=clock_timestamp() then 'inactive'
  else o.state end
 from play_billing_candidate.purchase_observations o join play_billing_candidate.purchase_claims c
 using(environment,package_name,fingerprint)
 where c.owner_id=p_owner and o.environment='test' and o.package_name='online.hoopcheck.app' and o.fingerprint=p_fingerprint
 ),'unavailable')
$body$;
revoke all on function play_billing_candidate.begin_test_refresh(text,uuid) from public,anon,authenticated,service_role;
revoke all on function play_billing_candidate.finish_test_refresh(text,uuid,bigint,text,timestamptz) from public,anon,authenticated,service_role;
revoke all on function play_billing_candidate.read_test_observation(text,uuid) from public,anon,authenticated,service_role;
grant execute on function play_billing_candidate.begin_test_refresh(text,uuid),play_billing_candidate.finish_test_refresh(text,uuid,bigint,text,timestamptz),play_billing_candidate.read_test_observation(text,uuid) to service_role;
commit;
