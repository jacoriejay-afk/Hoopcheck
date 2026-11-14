-- This fixture runs inside a rollback-only transaction. The test runner installs
-- the two versioned migrations and minimal platform tables before including it.
insert into auth.users (id, email, email_confirmed_at, created_at, raw_app_meta_data, raw_user_meta_data)
values
 ('10000000-0000-0000-0000-000000000001','amb1-owner@example.invalid',now(),now(),'{}',jsonb_build_object('full_name','AMB1 QA','username','amb1fixture1','account_type','fan','gender','male','position','PG','birthdate','1990-01-01','agreed_to_terms',true,'terms_accepted_at',now(),'terms_version','2026-10-01')),
 ('10000000-0000-0000-0000-000000000002','amb1-other@example.invalid',now(),now(),'{}',jsonb_build_object('full_name','AMB1 QA','username','amb1fixture2','account_type','fan','gender','male','position','PG','birthdate','1990-01-01','agreed_to_terms',true,'terms_accepted_at',now(),'terms_version','2026-10-01'));
insert into public.ambassador_campaigns (code, display_name) values ('AMB1TEST', 'Test campaign');
insert into public.ambassador_grants (id,user_id,code,status,agreement_signed_at,activated_at,ends_at,
 first_rate_bps,commission_rate_bps,agreement_reference,payout_terms_reference,approved_by)
values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','AMB1TEST','active',
 now()-interval '85 days',now()-interval '85 days',now()+interval '5 days',5000,1000,'fixture','fixture',
 '10000000-0000-0000-0000-000000000001');
create temp table amb1_links (name text, token uuid);
insert into amb1_links select name, public.ambassador_open_referral('AMB1TEST')
  from unnest(array['signup','duplicate','google','unverified','self']) n(name);
insert into auth.users (id,email,email_confirmed_at,created_at,raw_app_meta_data,raw_user_meta_data) values
 ('10000000-0000-0000-0000-000000000003','amb1-referee@example.invalid',now(),now(),'{"provider":"email"}',jsonb_build_object('full_name','AMB1 QA','username','amb1fixture3','account_type','player','gender','male','position','PG','birthdate','1990-01-01','agreed_to_terms',true,'terms_accepted_at',now(),'terms_version','2026-10-01') || jsonb_build_object('ambassador_token',(select token from amb1_links where name='signup'))),
 ('10000000-0000-0000-0000-000000000004','amb1-duplicate@example.invalid',now(),now(),'{"provider":"email"}',jsonb_build_object('full_name','AMB1 QA','username','amb1fixture4','account_type','fan','gender','male','position','PG','birthdate','1990-01-01','agreed_to_terms',true,'terms_accepted_at',now(),'terms_version','2026-10-01') || jsonb_build_object('ambassador_token',(select token from amb1_links where name='duplicate'))),
 ('10000000-0000-0000-0000-000000000005','amb1-disabled@example.invalid',now(),now(),'{"provider":"email"}',jsonb_build_object('full_name','AMB1 QA','username','amb1fixture5','account_type','manager','gender','male','position','PG','birthdate','1990-01-01','agreed_to_terms',true,'terms_accepted_at',now(),'terms_version','2026-10-01') || jsonb_build_object('ambassador_token',public.ambassador_open_referral('CHRISLYKES'))),
 ('10000000-0000-0000-0000-000000000006','amb1-google@example.invalid',now(),now(),'{"provider":"google"}','{}'),
 ('10000000-0000-0000-0000-000000000007','amb1-unverified@example.invalid',null,now(),'{"provider":"email"}',jsonb_build_object('full_name','AMB1 QA','username','amb1fixture7','account_type','agent','gender','male','position','PG','birthdate','1990-01-01','agreed_to_terms',true,'terms_accepted_at',now(),'terms_version','2026-10-01') || jsonb_build_object('ambassador_token',(select token from amb1_links where name='unverified'))),
 ('10000000-0000-0000-0000-000000000008','amb1-reused@example.invalid',now(),now(),'{"provider":"email"}',jsonb_build_object('full_name','AMB1 QA','username','amb1fixture8','account_type','coach','gender','male','position','PG','birthdate','1990-01-01','agreed_to_terms',true,'terms_accepted_at',now(),'terms_version','2026-10-01') || jsonb_build_object('ambassador_token',(select token from amb1_links where name='signup')));
select public.ambassador_capture_google('10000000-0000-0000-0000-000000000006',(select token from amb1_links where name='google'));
select hoopcheck_ambassador.capture('10000000-0000-0000-0000-000000000001',(select token from amb1_links where name='self'));

do $$
declare
  a uuid;
  duplicate_id uuid;
  owner_id constant uuid := '10000000-0000-0000-0000-000000000001';
  other_id constant uuid := '10000000-0000-0000-0000-000000000002';
  user_id constant uuid := '10000000-0000-0000-0000-000000000003';
  duplicate_user constant uuid := '10000000-0000-0000-0000-000000000004';
  grant_id constant uuid := '20000000-0000-0000-0000-000000000001';
  commission_id uuid;
  payment_time timestamptz := now() - interval '70 days';
  renewal_time timestamptz := now() - interval '35 days';
  payout uuid;
  i record;
begin
  if (select count(*) from public.ambassador_attributions) <> 4 then
    raise exception 'Expected email, Google, and unverified leads only';
  end if;
  if public.ambassador_checkout_attribution('10000000-0000-0000-0000-000000000007') is not null then
    raise exception 'Unverified email cannot qualify';
  end if;
  a := public.ambassador_checkout_attribution(user_id);
  duplicate_id := public.ambassador_checkout_attribution(duplicate_user);
  if a is null or duplicate_id is null then raise exception 'Verified signup not attributed'; end if;
  update public.ambassador_attributions set captured_at = now()-interval '72 days' where id in (a,duplicate_id);
  if public.ambassador_record_invoice(a,user_id,'cus_amb1','sub_amb1','in_fraud','ch_fraud',
    payment_time,'usd','pro',499,0,44,0,'fraud_fingerprint',true,0,'refund',now()) is not null then
    raise exception 'Fraudulent payment credited';
  end if;
  -- An upgrade or renewal can arrive before the first invoice.
  perform public.ambassador_record_invoice(a,user_id,'cus_amb1','sub_amb1','in_renewal','ch_renewal',
    renewal_time,'usd','premium',999,23,55,0,'shared_fingerprint',false,0,'refund',now());
  commission_id := public.ambassador_record_invoice(a,user_id,'cus_amb1','sub_amb1','in_first','ch_first',
    payment_time,'usd','pro',499,0,43,0,'shared_fingerprint',false,0,'refund',now());
  if commission_id is null then raise exception 'First payment missing'; end if;
  perform public.ambassador_record_invoice(a,user_id,'cus_amb1','sub_amb1','in_first','ch_first',
    payment_time,'usd','pro',499,0,43,0,'shared_fingerprint',false,0,'refund',now());
  if public.ambassador_record_invoice(duplicate_id,duplicate_user,'cus_duplicate','sub_dup','in_duplicate','ch_dup',
    payment_time,'usd','pro',499,0,43,0,'shared_fingerprint',false,0,'refund',now()) is not null then
    raise exception 'Duplicate payment method was credited twice';
  end if;
  if public.ambassador_record_invoice(a,user_id,'cus_amb1','sub_amb1','in_expired','ch_expired',
    (payment_time at time zone 'UTC' + interval '12 months') at time zone 'UTC',
    'usd','pro',499,0,43,0,'shared_fingerprint',false,0,'refund',now()) is not null then
    raise exception 'Commission window includes anniversary';
  end if;
  if (select array_agg(commission_minor order by paid_invoice_at) from public.ambassador_commissions) <> array[228,92]::bigint[] then
    raise exception 'Wrong rates, net revenue, or idempotency';
  end if;
  perform public.ambassador_subscription_status(a,user_id,'sub_amb1','cus_amb1','canceled',now());
  payout := public.ambassador_payout(grant_id,'usd',owner_id,'approve','');
  if (select amount_minor from public.ambassador_payouts where id = payout) <> 320 then raise exception 'Wrong payout'; end if;
  perform public.ambassador_reconcile_charge('ch_first',100,'refund',now()+interval '1 second');
  perform public.ambassador_reconcile_charge('ch_first',0,'refund',now());
  if (select adjustment_minor from public.ambassador_commissions where id = commission_id) <> 100 then
    raise exception 'Stale refund snapshot overrode newer data';
  end if;
  begin
    perform public.ambassador_payout(grant_id,'usd',owner_id,'settle','fixture transfer');
    raise exception 'Unexpected settlement' using errcode='P0002';
  exception when raise_exception then null;
  end;
  perform public.ambassador_payout(grant_id,'usd',owner_id,'cancel','');
  payout := public.ambassador_payout(grant_id,'usd',owner_id,'approve','');
  if (select amount_minor from public.ambassador_payouts where id = payout) <> 270 then raise exception 'Refund not reflected'; end if;
  perform public.ambassador_payout(grant_id,'usd',owner_id,'settle','fixture transfer');
  perform public.ambassador_reconcile_charge('ch_first',499,'dispute',now()+interval '2 seconds');
  if (select status from public.ambassador_payouts where id = payout) <> 'paid' then raise exception 'Payout history changed'; end if;
  perform public.ambassador_reconcile_charge('ch_first',100,'dispute',now()+interval '3 seconds');
  if (select count(*) from public.ambassador_commission_adjustments) <> 3
    then raise exception 'Refund, dispute and reinstatement audit required'; end if;

  perform public.ambassador_manage(owner_id, 'AMB1TEST', 'pause');
  if public.ambassador_dashboard(owner_id)->>'active' <> 'false' or
     (public.ambassador_dashboard(owner_id)->>'conversions')::int <> 1 or
     public.ambassador_dashboard(owner_id)#>>'{referrals,0,stripe_customer_id}' is not null or
     public.ambassador_dashboard(other_id) is not null
    then raise exception 'Incorrect HQ projection or isolation'; end if;
  if exists (select 1 from public.ambassador_grants where code='CHRISLYKES') then
    raise exception 'Real campaign unexpectedly attached';
  end if;

  -- Every app role uses authenticated or the pending Google role; none may
  -- query finance tables or call a service RPC, including the ambassador.
  for i in select rolname from pg_roles
      where rolname in ('anon','authenticated','hoopcheck_pending_signup') loop
    if has_table_privilege(i.rolname,'public.ambassador_commissions','SELECT') or
       has_table_privilege(i.rolname,'public.ambassador_attributions','SELECT') or
       has_table_privilege(i.rolname,'public.ambassador_payouts','SELECT') or
       has_table_privilege(i.rolname,'public.ambassador_grants','INSERT') or
       has_function_privilege(i.rolname,'public.ambassador_dashboard(uuid)','EXECUTE') or
       has_function_privilege(i.rolname,'public.ambassador_payout(uuid,text,uuid,text,text)','EXECUTE') then
      raise exception 'Unexpected finance access for %', i.rolname;
    end if;
  end loop;
end
$$;
select 'AMB-1 email/Google attribution, disabled campaign, fraud, replay, 12-month rates, refunds, disputes, payout and ACL passed' as result;
