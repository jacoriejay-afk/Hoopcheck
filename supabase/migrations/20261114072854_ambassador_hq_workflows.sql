-- AMB-1. Campaign preparation is independent of a HoopCheck account.
create table public.ambassador_campaigns (
  code text primary key check (code ~ '^[A-Z0-9_-]{4,40}$'),
  display_name text not null,
  created_at timestamptz not null default now()
);
insert into public.ambassador_campaigns (code, display_name) values ('CHRISLYKES', 'Chris Lykes');

alter table public.ambassador_grants
  add column first_rate_bps integer check (first_rate_bps between 0 and 10000),
  add column agreement_reference text,
  add column payout_terms_reference text,
  add column approved_by uuid,
  add column ends_at timestamptz,
  add constraint ambassador_signed_terms_required check (
    status <> 'active' or (
      first_rate_bps is not null
      and nullif(btrim(agreement_reference), '') is not null
      and nullif(btrim(payout_terms_reference), '') is not null
      and ends_at is not null and ends_at > activated_at and approved_by is not null
    )
  );
-- Keep accounting records when an account is deleted.
alter table public.ambassador_grants drop constraint ambassador_grants_user_id_fkey,
  alter column user_id drop not null,
  add foreign key (user_id) references auth.users(id) on delete set null;
alter table public.ambassador_attributions drop constraint ambassador_attributions_referred_user_id_fkey,
  alter column referred_user_id drop not null,
  add foreign key (referred_user_id) references auth.users(id) on delete set null,
  add column first_rate_bps integer not null check (first_rate_bps between 0 and 10000),
  add column renewal_rate_bps integer not null check (renewal_rate_bps between 0 and 10000),
  add column stripe_status text,
  add column disqualified_at timestamptz,
  add column disqualification_reason text;

alter table public.ambassador_commissions
  add column subscription_plan text check (subscription_plan in ('pro','premium')),
  add column tax_minor bigint not null default 0 check (tax_minor >= 0),
  add column fee_minor bigint not null default 0 check (fee_minor >= 0),
  add column discount_minor bigint not null default 0 check (discount_minor >= 0),
  add column adjustment_minor bigint not null default 0 check (adjustment_minor >= 0),
  add column stripe_charge_id text unique,
  add column source_checked_at timestamptz not null default '-infinity';

alter table public.ambassador_commission_adjustments
  add column previous_deduction_minor bigint not null default 0,
  add column current_deduction_minor bigint not null default 0;

alter table public.ambassador_payouts
  add column approved_by uuid,
  add column settled_by uuid;
create unique index ambassador_one_approved_payout
  on public.ambassador_payouts(ambassador_id, currency) where status = 'approved';

create table public.ambassador_payment_fingerprints (
  fingerprint text primary key,
  attribution_id uuid not null references public.ambassador_attributions(id)
);
create table public.ambassador_owner_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  ambassador_id uuid not null references public.ambassador_grants(id),
  action text not null,
  details jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.ambassador_campaigns enable row level security;
alter table public.ambassador_payment_fingerprints enable row level security;
alter table public.ambassador_owner_audit enable row level security;
-- Private data is projected by vetted server queries instead of exposing raw Stripe IDs or signed terms.
revoke all on public.ambassador_grants, public.ambassador_commissions,
  public.ambassador_commission_adjustments, public.ambassador_payouts, public.ambassador_payout_items,
  public.ambassador_campaigns, public.ambassador_payment_fingerprints, public.ambassador_owner_audit
  from public, anon, authenticated;
grant all on public.ambassador_campaigns, public.ambassador_payment_fingerprints, public.ambassador_owner_audit to service_role;

create schema if not exists hoopcheck_ambassador;
revoke all on schema hoopcheck_ambassador from public, anon, authenticated;

create table public.ambassador_referral_tokens (
  token uuid primary key default gen_random_uuid(),
  ambassador_id uuid not null references public.ambassador_grants(id),
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);
create index ambassador_referral_token_age on public.ambassador_referral_tokens(created_at);
alter table public.ambassador_referral_tokens enable row level security;
revoke all on public.ambassador_referral_tokens from public, anon, authenticated;

create function hoopcheck_ambassador.capture(p_user uuid, p_token uuid)
returns void language sql security definer set search_path = '' as $$
  with matched as (
    update public.ambassador_referral_tokens t set consumed_at = now()
    from public.ambassador_grants g, auth.users u, auth.users owner
    where t.token = p_token and t.consumed_at is null and t.ambassador_id = g.id
      and u.id = p_user and owner.id = g.user_id and g.status = 'active'
      and now() >= g.activated_at and now() < g.ends_at
      and t.created_at >= g.activated_at and t.created_at <= u.created_at
      and now() < t.created_at + interval '30 minutes'
      and u.id <> owner.id and lower(u.email) <> lower(owner.email)
      and not exists (
        select 1 from public.subscriptions s where s.user_id = u.id and s.stripe_customer_id is not null
      )
    returning g.id, g.first_rate_bps, g.commission_rate_bps
  )
  insert into public.ambassador_attributions (ambassador_id, referred_user_id, first_rate_bps, renewal_rate_bps)
  select id, p_user, first_rate_bps, commission_rate_bps from matched
  on conflict (referred_user_id) do nothing
$$;

create function hoopcheck_ambassador.capture_email_signup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.raw_app_meta_data->>'provider' = 'email'
     and (new.raw_user_meta_data->>'ambassador_token') ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then
    perform hoopcheck_ambassador.capture(new.id, (new.raw_user_meta_data->>'ambassador_token')::uuid);
  end if;
  return new;
end;
$$;
create trigger ambassador_capture_email_signup after insert on auth.users
for each row execute function hoopcheck_ambassador.capture_email_signup();

create function public.ambassador_capture_google(p_user uuid, p_token uuid)
returns void language sql security definer set search_path = '' as $$
  select hoopcheck_ambassador.capture(p_user, p_token)
  where exists (
    select 1 from auth.users u where u.id = p_user and u.email_confirmed_at is not null
      and u.raw_app_meta_data->>'provider' = 'google'
  )
$$;

create function public.ambassador_checkout_attribution(p_user uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select a.id from public.ambassador_attributions a
  join auth.users u on u.id = a.referred_user_id
  where u.id = p_user and u.email_confirmed_at is not null and a.disqualified_at is null
$$;

create function public.ambassador_record_invoice(
  p_attribution uuid, p_user uuid, p_customer text, p_subscription text, p_invoice text,
  p_charge text, p_paid_at timestamptz, p_currency text, p_plan text, p_gross bigint,
  p_tax bigint, p_fee bigint, p_discount bigint, p_fingerprint text, p_fraud boolean,
  p_deduction bigint, p_reason text, p_checked_at timestamptz
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  a public.ambassador_attributions%rowtype;
  existing_id uuid;
  first_paid timestamptz;
  campaign_end timestamptz;
  net_amount bigint;
  rate integer;
begin
  select * into a from public.ambassador_attributions
    where id = p_attribution and referred_user_id = p_user;
  if not found then return null; end if;
  -- Serialize invoice, adjustment and payout changes for one ambassador.
  select ends_at into campaign_end from public.ambassador_grants where id = a.ambassador_id for update;
  select * into a from public.ambassador_attributions where id = a.id for update;
  if a.disqualified_at is not null or (a.stripe_customer_id is not null and a.stripe_customer_id <> p_customer)
     or p_paid_at < a.captured_at or not exists (
       select 1 from auth.users u where u.id = p_user and u.email_confirmed_at is not null
     ) then return null; end if;
  if exists (select 1 from public.ambassador_attributions where stripe_customer_id = p_customer and id <> a.id)
    or exists (select 1 from public.ambassador_grants g join public.subscriptions s on s.user_id = g.user_id
      where g.id = a.ambassador_id and s.stripe_customer_id = p_customer) then return null; end if;
  select id into existing_id from public.ambassador_commissions
    where stripe_invoice_id = p_invoice and attribution_id = a.id and stripe_charge_id = p_charge;
  if found then
    perform public.ambassador_reconcile_charge(p_charge,p_deduction,p_reason,p_checked_at);
    return existing_id;
  end if;
  if p_fingerprint is null or p_fraud or (p_paid_at >= campaign_end and
      (a.first_paid_at is null or a.first_paid_at >= campaign_end)) then
    return null;
  end if;
  insert into public.ambassador_payment_fingerprints (fingerprint, attribution_id)
    values (p_fingerprint, a.id) on conflict do nothing;
  if not exists (select 1 from public.ambassador_payment_fingerprints where fingerprint = p_fingerprint and attribution_id = a.id)
    then return null; end if;

  first_paid := least(a.first_paid_at, p_paid_at);
  if p_paid_at >= ((first_paid at time zone 'UTC') + interval '12 months') at time zone 'UTC'
    then return null; end if;
  net_amount := greatest(0, p_gross - p_tax - p_fee);
  rate := case when a.first_paid_at is null or p_paid_at < a.first_paid_at
    then a.first_rate_bps else a.renewal_rate_bps end;
  if p_paid_at = a.first_paid_at and exists (
    select 1 from public.ambassador_commissions
    where attribution_id = a.id and paid_invoice_at = p_paid_at and stripe_invoice_id > p_invoice
  ) then rate := a.first_rate_bps; end if;
  if (a.first_paid_at is not null and p_paid_at < a.first_paid_at) or
      (p_paid_at = a.first_paid_at and exists (
        select 1 from public.ambassador_commissions
        where attribution_id = a.id and paid_invoice_at = p_paid_at and stripe_invoice_id > p_invoice
      )) then
    -- Late delivery can change the first-payment rate before payout. Settled exceptions need reconciliation.
    if exists (select 1 from public.ambassador_commissions
      where attribution_id = a.id and status in ('approved','paid')) then
      raise exception 'Late first payment requires owner reconciliation';
    end if;
    insert into public.ambassador_owner_audit (actor_id, ambassador_id, action, details)
    select g.approved_by, g.id, 'payment_order_correction', jsonb_build_object(
      'attribution_id', a.id, 'previous_first_paid_at', a.first_paid_at, 'first_paid_at', first_paid
    ) from public.ambassador_grants g where g.id = a.ambassador_id;
    update public.ambassador_commissions
    set commission_rate_bps = a.renewal_rate_bps,
        commission_minor = round(net_minor::numeric * a.renewal_rate_bps / 10000),
        status = case when paid_invoice_at >= ((first_paid at time zone 'UTC') + interval '12 months') at time zone 'UTC'
          then 'reversed' else status end
    where attribution_id = a.id;
  end if;
  update public.ambassador_attributions set
    stripe_customer_id = p_customer, stripe_subscription_id = coalesce(stripe_subscription_id, p_subscription),
    first_paid_at = first_paid where id = a.id;
  insert into public.ambassador_commissions (
    ambassador_id, attribution_id, stripe_invoice_id, stripe_charge_id, currency, subscription_plan,
    gross_minor, tax_minor, fee_minor, discount_minor, net_minor, commission_rate_bps, commission_minor, paid_invoice_at
  ) values (
    a.ambassador_id, a.id, p_invoice, p_charge, p_currency, p_plan,
    p_gross, p_tax, p_fee, p_discount, net_amount, rate, round(net_amount::numeric * rate / 10000), p_paid_at
  ) returning id into existing_id;
  perform public.ambassador_reconcile_charge(p_charge,p_deduction,p_reason,p_checked_at);
  return existing_id;
end;
$$;

create function public.ambassador_reconcile_charge(
  p_charge text, p_deduction bigint, p_reason text, p_checked_at timestamptz
) returns void language plpgsql security definer set search_path = '' as $$
declare
  c public.ambassador_commissions%rowtype;
  deduction bigint;
begin
  select * into c from public.ambassador_commissions where stripe_charge_id = p_charge;
  if not found then return; end if;
  perform 1 from public.ambassador_grants where id = c.ambassador_id for update;
  select * into c from public.ambassador_commissions where id = c.id for update;
  if p_checked_at < c.source_checked_at then return; end if;
  deduction := least(c.net_minor, greatest(0, round(
    p_deduction::numeric * (c.gross_minor - c.tax_minor) / nullif(c.gross_minor,0)
  )));
  if deduction <> c.adjustment_minor then
    insert into public.ambassador_commission_adjustments (
      commission_id, amount_minor, reason, previous_deduction_minor, current_deduction_minor
    ) values (c.id, abs(deduction - c.adjustment_minor), p_reason, c.adjustment_minor, deduction);
  end if;
  update public.ambassador_commissions set adjustment_minor = deduction,
    source_checked_at = p_checked_at where id = c.id;
end;
$$;

create table public.ambassador_clicks (
  ambassador_id uuid primary key references public.ambassador_grants(id),
  clicks bigint not null default 0 check (clicks >= 0)
);
alter table public.ambassador_clicks enable row level security;
revoke all on public.ambassador_clicks from public, anon, authenticated;
grant select on public.ambassador_clicks to service_role;

create function public.ambassador_dashboard(p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
select jsonb_build_object(
  'code', g.code, 'status', g.status, 'active', g.status = 'active' and now() >= g.activated_at and now() < g.ends_at,
  'clicks', coalesce((select clicks from public.ambassador_clicks where ambassador_id = g.id),0),
  'signups', (select count(*) from public.ambassador_attributions a
    where a.ambassador_id = g.id and a.disqualified_at is null
      and (a.first_paid_at is not null or exists (
        select 1 from auth.users u where u.id = a.referred_user_id and u.email_confirmed_at is not null
      ))),
  'conversions', (select count(*) from public.ambassador_attributions a
    where a.ambassador_id = g.id and a.first_paid_at is not null and a.disqualified_at is null),
  'commissions', coalesce((select jsonb_agg(to_jsonb(c)) from (
    select id, attribution_id, currency, subscription_plan, paid_invoice_at, gross_minor, tax_minor, fee_minor,
      discount_minor, net_minor, adjustment_minor, commission_rate_bps,
      case when status = 'reversed' then 0 else round((net_minor-adjustment_minor)::numeric*commission_rate_bps/10000) end as earnings,
      status from public.ambassador_commissions where ambassador_id = g.id order by paid_invoice_at desc limit 100
  ) c), '[]'::jsonb),
  'totals', coalesce((select jsonb_agg(to_jsonb(c)) from (
    select currency, sum(round((net_minor-adjustment_minor)::numeric*commission_rate_bps/10000)) as earned
    from public.ambassador_commissions where ambassador_id = g.id and status <> 'reversed' group by currency
  ) c), '[]'::jsonb),
  'referrals', coalesce((select jsonb_agg(to_jsonb(a)) from (
    select a.id, a.captured_at, a.first_paid_at, a.stripe_status
    from public.ambassador_attributions a where a.ambassador_id = g.id and a.disqualified_at is null
      and (a.first_paid_at is not null or exists (
        select 1 from auth.users u where u.id = a.referred_user_id and u.email_confirmed_at is not null
      ))
    order by a.captured_at desc limit 100
  ) a), '[]'::jsonb),
  'payouts', coalesce((select jsonb_agg(to_jsonb(p)) from (
    select id, currency, amount_minor, status, approved_at, paid_at
    from public.ambassador_payouts where ambassador_id = g.id order by created_at desc limit 100
  ) p), '[]'::jsonb)
) from public.ambassador_grants g where g.user_id = p_user
$$;

create function public.ambassador_payout(p_ambassador uuid, p_currency text, p_actor uuid, p_action text, p_reference text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  payout public.ambassador_payouts%rowtype;
  payable bigint;
begin
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
$$;

revoke execute on all functions in schema hoopcheck_ambassador from public, anon, authenticated;
revoke all on function public.ambassador_capture_google(uuid,uuid),
  public.ambassador_checkout_attribution(uuid), public.ambassador_dashboard(uuid),
  public.ambassador_record_invoice(uuid,uuid,text,text,text,text,timestamptz,text,text,bigint,bigint,bigint,bigint,text,boolean,bigint,text,timestamptz),
  public.ambassador_reconcile_charge(text,bigint,text,timestamptz),
  public.ambassador_payout(uuid,text,uuid,text,text) from public, anon, authenticated;
grant execute on function public.ambassador_capture_google(uuid,uuid),
  public.ambassador_checkout_attribution(uuid), public.ambassador_dashboard(uuid),
  public.ambassador_record_invoice(uuid,uuid,text,text,text,text,timestamptz,text,text,bigint,bigint,bigint,bigint,text,boolean,bigint,text,timestamptz),
  public.ambassador_reconcile_charge(text,bigint,text,timestamptz),
  public.ambassador_payout(uuid,text,uuid,text,text) to service_role;

create function public.ambassador_manage(
  p_actor uuid, p_code text, p_action text, p_user uuid default null, p_first integer default null,
  p_renewal integer default null, p_signed_at timestamptz default null, p_agreement text default null,
  p_terms text default null, p_days integer default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  g public.ambassador_grants%rowtype;
begin
  perform 1 from public.ambassador_campaigns where code = p_code for update;
  if not found then raise exception 'Unknown campaign'; end if;
  select * into g from public.ambassador_grants where code = p_code for update;
  if p_action = 'link' then
    if g.id is not null or not exists (
      select 1 from auth.users u join public.profiles p on p.id = u.id
      where u.id = p_user and u.email_confirmed_at is not null
    ) then raise exception 'A verified existing HoopCheck account is required'; end if;
    insert into public.ambassador_grants (code,user_id,approved_by)
      values (p_code,p_user,p_actor) returning * into g;
  elsif p_action = 'activate' then
    if g.user_id is null or g.activated_at is not null or p_days is null or p_days not between 1 and 366
      or p_signed_at is null or p_signed_at > now() then raise exception 'Campaign cannot be activated'; end if;
    update public.ambassador_grants set status = 'active', activated_at = now(),
      ends_at = now() + make_interval(days => p_days), first_rate_bps = p_first,
      commission_rate_bps = p_renewal, agreement_signed_at = p_signed_at,
      agreement_reference = p_agreement, payout_terms_reference = p_terms, approved_by = p_actor
    where id = g.id returning * into g;
  elsif p_action = 'amend' then
    if g.activated_at is null or p_signed_at is null or p_signed_at > now()
      or p_first is null or p_renewal is null or nullif(btrim(p_agreement),'') is null
      or nullif(btrim(p_terms),'') is null then raise exception 'Signed amendment details required'; end if;
    update public.ambassador_grants set first_rate_bps = p_first, commission_rate_bps = p_renewal,
      agreement_signed_at = p_signed_at, agreement_reference = p_agreement, payout_terms_reference = p_terms
    where id = g.id returning * into g;
  elsif p_action = 'pause' then
    if g.status <> 'active' or g.id is null then raise exception 'No active campaign'; end if;
    update public.ambassador_grants set status = 'suspended', ends_at = least(now(), ends_at)
    where id = g.id returning * into g;
  else raise exception 'Invalid campaign action';
  end if;
  insert into public.ambassador_owner_audit (actor_id, ambassador_id, action, details)
    values (p_actor, g.id, p_action, jsonb_build_object(
      'user_id', g.user_id, 'first_rate_bps', g.first_rate_bps, 'renewal_rate_bps', g.commission_rate_bps,
      'signed_at', g.agreement_signed_at, 'agreement', g.agreement_reference,
      'payout_terms', g.payout_terms_reference, 'ends_at', g.ends_at
    ));
end;
$$;
revoke all on function public.ambassador_manage(uuid,text,text,uuid,integer,integer,timestamptz,text,text,integer)
  from public, anon, authenticated;
grant execute on function public.ambassador_manage(uuid,text,text,uuid,integer,integer,timestamptz,text,text,integer)
  to service_role;

alter table public.ambassador_attributions add column stripe_subscription_created_at timestamptz;
create function public.ambassador_has_charge(p_charge text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.ambassador_commissions where stripe_charge_id = p_charge)
$$;
create function public.ambassador_subscription_status(
  p_id uuid, p_user uuid, p_subscription text, p_customer text, p_status text, p_created_at timestamptz
) returns void language sql security definer set search_path = '' as $$
  update public.ambassador_attributions set stripe_subscription_id = p_subscription,
    stripe_status = p_status, stripe_subscription_created_at = p_created_at
  where id = p_id and referred_user_id = p_user and disqualified_at is null
    and (stripe_customer_id is null or stripe_customer_id = p_customer)
    and (stripe_subscription_created_at is null or stripe_subscription_created_at <= p_created_at)
$$;
revoke all on function public.ambassador_has_charge(text),
  public.ambassador_subscription_status(uuid,uuid,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.ambassador_has_charge(text),
  public.ambassador_subscription_status(uuid,uuid,text,text,text,timestamptz) to service_role;

create function public.ambassador_open_referral(p_code text)
returns uuid language sql security definer set search_path = '' as $$
  with accepted as (
    insert into public.ambassador_clicks (ambassador_id, clicks)
    select g.id, 1 from public.ambassador_grants g
    where g.code = p_code and g.user_id is not null and g.status = 'active'
      and now() >= g.activated_at and now() < g.ends_at
    on conflict (ambassador_id) do update set clicks = public.ambassador_clicks.clicks + 1
    returning ambassador_id
  )
  insert into public.ambassador_referral_tokens (ambassador_id)
  select ambassador_id from accepted returning token
$$;
revoke all on function public.ambassador_open_referral(text) from public, anon, authenticated;
grant execute on function public.ambassador_open_referral(text) to service_role;
