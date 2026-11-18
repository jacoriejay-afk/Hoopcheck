-- Defense in depth for service-role-only ambassador payout operations.
-- p_actor must be the server-verified owner identity; do not expose this RPC to clients.
CREATE OR REPLACE FUNCTION public.ambassador_payout(p_ambassador uuid, p_currency text, p_actor uuid, p_action text, p_reference text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  payout public.ambassador_payouts%rowtype;
  payable bigint;
begin
  -- This RPC is service-role only; the server supplies the verified owner actor.
  if not exists (
    select 1 from hoopcheck_security.owner_accounts where user_id = p_actor
  ) then
    raise exception 'Unauthorized payout actor';
  end if;
  perform 1 from public.ambassador_grants where id = p_ambassador for update;
  if not found then raise exception 'Ambassador not found'; end if;
  select * into payout from public.ambassador_payouts
    where ambassador_id = p_ambassador and currency = p_currency and status = 'approved' for update;
  if p_action = 'cancel' then
    if payout.id is null then raise exception 'No approved payout'; end if;
    update public.ambassador_commissions set status = 'pending'
      where id in (select commission_id from public.ambassador_payout_items where payout_id = payout.id);
    delete from public.ambassador_payout_items where payout_id = payout.id;
    update public.ambassador_payouts set status = 'cancelled' where id = payout.id;
  elsif p_action in ('approve','settle') then
    select coalesce(sum(round((net_minor-adjustment_minor)::numeric*commission_rate_bps/10000)),0)
      - coalesce((select sum(amount_minor) from public.ambassador_payouts
        where ambassador_id = p_ambassador and currency = p_currency and status = 'paid'),0)
    into payable from public.ambassador_commissions
    where ambassador_id = p_ambassador and currency = p_currency and status = any(
      case when p_action = 'approve' then array['pending','paid'] else array['approved','paid'] end
    ) and paid_invoice_at + interval '30 days' <= now();
    if payable <= 0 then raise exception 'No positive balance after the refund validation period'; end if;
    if p_action = 'approve' then
      if payout.id is not null then raise exception 'An approved payout already exists'; end if;
      insert into public.ambassador_payouts (ambassador_id, currency, amount_minor, status, approved_at, approved_by)
        values (p_ambassador, p_currency, payable, 'approved', now(), p_actor) returning * into payout;
      with selected as (
        update public.ambassador_commissions set status = 'approved'
        where ambassador_id = p_ambassador and currency = p_currency and status = 'pending'
          and paid_invoice_at + interval '30 days' <= now()
        returning id
      ) insert into public.ambassador_payout_items (payout_id, commission_id) select payout.id, id from selected;
    else
      if payout.id is null or payout.amount_minor <> payable or nullif(btrim(p_reference),'') is null then
        raise exception 'Payout amount changed or transfer reference is missing';
      end if;
      update public.ambassador_commissions set status = 'paid'
        where id in (select commission_id from public.ambassador_payout_items where payout_id = payout.id);
      update public.ambassador_payouts set status = 'paid', paid_at = now(),
        settled_by = p_actor, external_reference = p_reference where id = payout.id;
    end if;
  else raise exception 'Invalid payout action';
  end if;
  insert into public.ambassador_owner_audit (actor_id, ambassador_id, action, details)
    values (p_actor, p_ambassador, 'payout_' || p_action, jsonb_build_object('payout_id',payout.id,'amount_minor',payout.amount_minor));
  return payout.id;
end;
$function$
;

revoke all on function public.ambassador_payout(uuid,text,uuid,text,text) from public, anon, authenticated;
grant execute on function public.ambassador_payout(uuid,text,uuid,text,text) to service_role;
