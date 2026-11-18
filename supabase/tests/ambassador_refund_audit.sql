-- Included by the isolated rollback-only harness, after the commission lifecycle.
-- Never run this fixture on a hosted project or use real Stripe identities.
do $$
declare
  before_ledger jsonb;
  after_ledger jsonb;
  stamp timestamptz := '2026-11-01T12:00:00Z';
  role_name text;
begin
  select jsonb_agg(to_jsonb(c) order by id) into before_ledger from public.ambassador_commissions c;
  perform set_config('request.jwt.claim.role','service_role',true);
  perform public.ambassador_record_refund_audit('re_fixture_first','ch_first',100,'USD','pending',stamp);
  perform public.ambassador_record_refund_audit('re_fixture_second','ch_first',50,'usd','succeeded',stamp+interval '1 second');
  perform public.ambassador_record_refund_audit('re_fixture_first','ch_first',100,'usd','succeeded',stamp);
  perform public.ambassador_record_refund_audit('re_fixture_first','ch_first',100,'usd','succeeded',stamp);
  if (select count(*) from public.ambassador_refund_audit) <> 2 or
     (select refund_status from public.ambassador_refund_audit where stripe_refund_id='re_fixture_first') <> 'succeeded' or
     (select currency from public.ambassador_refund_audit where stripe_refund_id='re_fixture_first') <> 'usd' then
    raise exception 'Refund identity replay or status update failed';
  end if;
  -- A reused Stripe refund identity cannot change its immutable receipt evidence.
  perform public.ambassador_record_refund_audit('re_fixture_first','ch_first',999,'usd','failed',stamp);
  perform public.ambassador_record_refund_audit('re_fixture_first','ch_renewal',100,'usd','failed',stamp);
  perform public.ambassador_record_refund_audit('re_fixture_first','ch_first',100,'eur','failed',stamp);
  perform public.ambassador_record_refund_audit('re_fixture_first','ch_first',100,'usd','failed',stamp+interval '1 day');
  if (select count(*) from public.ambassador_refund_audit) <> 2 or
     not exists(select 1 from public.ambassador_refund_audit where stripe_refund_id='re_fixture_first'
       and stripe_charge_id='ch_first' and amount_minor=100 and currency='usd'
       and refund_status='succeeded' and stripe_created_at=stamp) then
    raise exception 'Conflicting refund identity changed receipt evidence';
  end if;
  perform public.ambassador_record_refund_audit('re_fixture_missing','ch_not_attributed',10,'usd','succeeded',stamp);
  if exists(select 1 from public.ambassador_refund_audit where stripe_refund_id='re_fixture_missing') then
    raise exception 'Unattributed charge acquired a refund ledger entry';
  end if;
  begin
    perform public.ambassador_record_refund_audit('re_fixture_negative','ch_first',-1,'usd','succeeded',stamp);
    raise exception 'Negative refund amount accepted' using errcode='P0002';
  exception when check_violation then null;
  end;
  begin
    perform public.ambassador_record_refund_audit(null,'ch_first',1,'usd','succeeded',stamp);
    raise exception 'Missing refund identity accepted' using errcode='P0002';
  exception when raise_exception then
    if sqlerrm <> 'missing refund audit fields' then raise; end if;
  end;
  perform set_config('request.jwt.claim.role','authenticated',true);
  begin
    perform public.ambassador_record_refund_audit('re_fixture_forged','ch_first',1,'usd','succeeded',stamp);
    raise exception 'Non-service refund claim accepted' using errcode='P0002';
  exception when raise_exception then
    if sqlerrm <> 'service role required' then raise; end if;
  end;
  perform set_config('request.jwt.claim.role','service_role',true);
  foreach role_name in array array['anon','authenticated','hoopcheck_pending_signup'] loop
    if has_table_privilege(role_name,'public.ambassador_refund_audit','SELECT') or
       has_table_privilege(role_name,'public.ambassador_refund_audit','INSERT') or
       has_function_privilege(role_name,'public.ambassador_record_refund_audit(text,text,bigint,text,text,timestamptz)','EXECUTE') then
      raise exception 'Refund audit exposed to client role %', role_name;
    end if;
  end loop;
  if not has_function_privilege('service_role','public.ambassador_record_refund_audit(text,text,bigint,text,text,timestamptz)','EXECUTE') or
     not (select relrowsecurity from pg_class where oid='public.ambassador_refund_audit'::regclass) then
    raise exception 'Refund service-role grant or RLS missing';
  end if;
  select jsonb_agg(to_jsonb(c) order by id) into after_ledger from public.ambassador_commissions c;
  if after_ledger is distinct from before_ledger then raise exception 'Receipt audit altered commission/payout calculation'; end if;
end;
$$;
select 'AMB refund audit: replay, immutable identities, role isolation and independent commission calculation passed' as result;
