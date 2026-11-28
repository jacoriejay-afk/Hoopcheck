-- Review-only disposable test verification budget. Never apply to a hosted DB
-- before isolated full-schema and retention approval. No entitlement writes.
begin;
create table play_billing_candidate.verification_budget(
 owner_id uuid primary key,
 window_started_at timestamptz not null,
 attempts integer not null check(attempts between 1 and 5)
);
alter table play_billing_candidate.verification_budget enable row level security;
alter table play_billing_candidate.verification_budget force row level security;
revoke all on play_billing_candidate.verification_budget from public,anon,authenticated,service_role;
grant select,insert on play_billing_candidate.verification_budget to service_role;
grant update(window_started_at,attempts) on play_billing_candidate.verification_budget to service_role;
create policy budget_read on play_billing_candidate.verification_budget for select to service_role using(true);
create policy budget_insert on play_billing_candidate.verification_budget for insert to service_role with check(true);
create policy budget_update on play_billing_candidate.verification_budget for update to service_role using(true) with check(true);
-- Public RPC name is service-only; underlying table stays in private schema.
-- One row per owner, atomic rolling window anchored at first permitted attempt.
create function public.play_take_test_verification_budget(p_owner uuid)
returns boolean language plpgsql volatile security invoker set search_path='' as $body$
declare affected integer; t timestamptz;
begin
 if p_owner is null then return false; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hoopcheck-play-verify:'||p_owner::text,0));
 t:=clock_timestamp();
 insert into play_billing_candidate.verification_budget as b(owner_id,window_started_at,attempts)
 values(p_owner,t,1)
 on conflict(owner_id) do update set
 window_started_at=case when b.window_started_at<=t-interval '10 minutes' then t else b.window_started_at end,
 attempts=case when b.window_started_at<=t-interval '10 minutes' then 1 else b.attempts+1 end
 where b.window_started_at<=t-interval '10 minutes' or (b.window_started_at<=t and b.attempts<5);
 get diagnostics affected=row_count;
 return affected=1;
end
$body$;
revoke all on function public.play_take_test_verification_budget(uuid) from public,anon,authenticated,service_role;
grant execute on function public.play_take_test_verification_budget(uuid) to service_role;
commit;
