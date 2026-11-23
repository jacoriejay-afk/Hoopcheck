-- Review-only candidate. DO NOT APPLY to production without authorized owner
-- approval, matching signed tracking-live date, exact PostgreSQL 17 rehearsal
-- and signed HTTP owner/non-owner regression. Separate from Build 9 migrations.
--
-- Restores only the previously signed 90-day CHRISLYKES promotional period
-- after an explicit audited pause. Does not reset the campaign, create a
-- new term, change rates, or alter existing referral/commission records.
create function public.ambassador_resume_signed_term(
  p_actor uuid,
  p_code text,
  p_confirmed_original_end_date date,
  p_reason text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  g public.ambassador_grants%rowtype;
  pause_time timestamptz;
  original_end timestamptz;
begin
  if p_actor is null or p_code is distinct from 'CHRISLYKES'
    or p_confirmed_original_end_date is null
    or p_reason is null or length(btrim(p_reason)) < 15 or length(p_reason) > 500
  then
    raise exception 'Signed campaign resumption confirmation is required';
  end if;

  select * into g from public.ambassador_grants
  where code = p_code for update;
  if not found or g.status <> 'suspended' or g.user_id is null
    or g.activated_at is null or g.agreement_signed_at is null
    or g.approved_by is null or g.first_rate_bps is distinct from 5000
    or g.commission_rate_bps is distinct from 1000
    or nullif(btrim(g.agreement_reference), '') is null
    or nullif(btrim(g.payout_terms_reference), '') is null
  then
    raise exception 'Campaign or signed terms not eligible for resumption';
  end if;

  -- Restore the original term captured BEFORE the latest pause.
  select max(a.created_at) into pause_time
  from public.ambassador_owner_audit a
  where a.ambassador_id = g.id and a.action = 'pause';

  select (a.details->>'ends_at')::timestamptz into original_end
  from public.ambassador_owner_audit a
  where a.ambassador_id = g.id
    and a.action in ('activate','amend')
    and a.created_at < pause_time
  order by a.created_at desc limit 1;

  if pause_time is null or original_end is null
    or original_end <= now()
    or original_end::date is distinct from p_confirmed_original_end_date
    or original_end is distinct from g.activated_at + interval '90 days'
    or not exists (
      select 1 from public.ambassador_owner_audit a
      where a.ambassador_id = g.id and a.action = 'pause'
        and a.created_at = pause_time
        and (a.details->>'ends_at')::timestamptz = g.ends_at
    )
  then
    raise exception 'Recorded pause and original 90-day signed term do not reconcile';
  end if;

  update public.ambassador_grants set status = 'active', ends_at = original_end
  where id = g.id and status = 'suspended';
  if not found then raise exception 'Campaign changed during resumption'; end if;

  insert into public.ambassador_owner_audit(actor_id, ambassador_id, action, details)
  values(p_actor, g.id, 'resume_signed_term',
    jsonb_build_object(
      'reason', btrim(p_reason), 'previous_end', g.ends_at,
      'restored_original_end', original_end,
      'first_rate_bps', g.first_rate_bps, 'renewal_rate_bps', g.commission_rate_bps
    ));
end;
$$;
revoke all on function public.ambassador_resume_signed_term(uuid,text,date,text)
  from public, anon, authenticated;
grant execute on function public.ambassador_resume_signed_term(uuid,text,date,text)
  to service_role;
