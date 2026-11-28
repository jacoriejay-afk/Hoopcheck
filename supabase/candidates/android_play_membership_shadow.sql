-- REVIEW ONLY: private shadow projection for disposable PG17.
-- Requires existing membership_sources and Play candidate claims/observations/
-- receipts. Never replace public entitlement views with test purchase data.
begin;
create view play_billing_candidate.shadow_play_sources with(security_invoker=true) as
select
 c.fingerprint as source_id,c.owner_id as user_id,
 case c.product_id when 'hoopcheck.premium' then 'premium' else 'pro' end as plan,
 'active'::text as status,
 case c.product_id when 'hoopcheck.premium' then 'premium' else 'pro' end as access_status,
 o.expires_at as current_period_end,
 -- Renewal/cancellation status must be independently stored before live use.
 null::boolean as cancel_at_period_end,
 case c.base_plan_id when 'monthly' then 'month' when 'six-month' then '6_month' else 'year' end as billing_interval,
 'google_play_test'::text as provider
from play_billing_candidate.purchase_claims c
join play_billing_candidate.purchase_observations o using(environment,package_name,fingerprint)
join play_billing_candidate.test_fulfillments f using(environment,package_name,fingerprint,generation)
where c.environment='test' and c.package_name='online.hoopcheck.app'
 and not exists(select 1 from play_billing_candidate.owner_holds h where h.owner_id=c.owner_id)
 and f.owner_id=c.owner_id and f.product_id=c.product_id and f.base_plan_id=c.base_plan_id
 and f.expires_at=o.expires_at and o.generation=o.completed_generation
 and o.state='eligible_for_reconciliation'
 and o.expires_at>clock_timestamp()
 and o.checked_at between clock_timestamp()-interval '30 minutes' and clock_timestamp();

create view play_billing_candidate.shadow_membership_sources with(security_invoker=true) as
select id::text as source_id,user_id,plan,status,access_status,current_period_end,cancel_at_period_end,billing_interval,provider
from public.membership_sources
union all
select source_id,user_id,plan,status,access_status,current_period_end,cancel_at_period_end,billing_interval,provider
from play_billing_candidate.shadow_play_sources;

-- Deliberately match existing public membership ranking and legacy
-- access_status guard; only the source identifier type differs in the shadow.
create view play_billing_candidate.shadow_membership_entitlements with(security_invoker=true) as
with ranked as(
 select *,row_number() over(partition by user_id order by
  (coalesce(plan in ('pro','premium') and status in ('active','trialing') and (current_period_end is null or current_period_end>now()),false)) desc,
  case plan when 'premium' then 2 when 'pro' then 1 else 0 end desc,
  current_period_end desc nulls first,provider,source_id) as position
 from play_billing_candidate.shadow_membership_sources
)
select source_id,user_id,plan,status,access_status,current_period_end,cancel_at_period_end,billing_interval,provider from ranked where position=1;
create view play_billing_candidate.shadow_membership_authorizations with(security_invoker=true) as
with guarded as(
 select source_id,user_id,plan,
  case when provider in ('stripe','manual') and coalesce(access_status,'active') not in ('active','trialing','pro','premium') then 'expired' else status end as status,
  access_status,current_period_end,cancel_at_period_end,billing_interval,provider
 from play_billing_candidate.shadow_membership_sources
),ranked as(
 select *,row_number() over(partition by user_id order by
  (coalesce(plan in ('pro','premium') and status in ('active','trialing') and (current_period_end is null or current_period_end>now()),false)) desc,
  case plan when 'premium' then 2 when 'pro' then 1 else 0 end desc,
  current_period_end desc nulls first,provider,source_id) as position
 from guarded
)
select source_id,user_id,plan,status,access_status,current_period_end,cancel_at_period_end,billing_interval,provider from ranked where position=1;
revoke all on play_billing_candidate.shadow_play_sources,play_billing_candidate.shadow_membership_sources,play_billing_candidate.shadow_membership_entitlements,play_billing_candidate.shadow_membership_authorizations from public,anon,authenticated,service_role;
grant select on play_billing_candidate.shadow_play_sources,play_billing_candidate.shadow_membership_sources,play_billing_candidate.shadow_membership_entitlements,play_billing_candidate.shadow_membership_authorizations to service_role;
commit;
