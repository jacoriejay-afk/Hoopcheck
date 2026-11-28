-- Unapplied isolated PostgreSQL candidate, after ownership and lifecycle.
-- Never expose this schema or connect these receipts to production access.
begin;
create table play_billing_candidate.purchase_intents (
 intent_id uuid primary key,
 owner_id uuid not null,
 session_id uuid not null,
 account_id text not null check(account_id ~ '^[0-9a-f]{64}$'),
 product_id text not null check(product_id in ('hoopcheck.pro','hoopcheck.premium')),
 base_plan_id text not null check(base_plan_id in ('monthly','six-month','annual')),
 price_micros text not null check(price_micros ~ '^[1-9][0-9]{0,15}$'),
 currency text not null check(currency ~ '^[A-Z]{3}$'),
 issued_at timestamptz not null,
 expires_at timestamptz not null check(expires_at > issued_at and expires_at <= issued_at + interval '60 seconds'),
 consumed_at timestamptz check(consumed_at >= issued_at and consumed_at < expires_at)
);
create index play_intent_owner_time on play_billing_candidate.purchase_intents(owner_id,issued_at desc);
alter table play_billing_candidate.purchase_intents enable row level security;
alter table play_billing_candidate.purchase_intents force row level security;
revoke all on play_billing_candidate.purchase_intents from public,anon,authenticated,service_role;
grant select,insert on play_billing_candidate.purchase_intents to service_role;
grant update(consumed_at) on play_billing_candidate.purchase_intents to service_role;
create policy server_intents_read on play_billing_candidate.purchase_intents for select to service_role using(true);
create policy server_intents_insert on play_billing_candidate.purchase_intents for insert to service_role with check(true);
create policy server_intents_consume on play_billing_candidate.purchase_intents for update to service_role using(consumed_at is null) with check(consumed_at is not null);
-- The caller must establish verified Auth session, MFA, role, freeze,
-- provider catalog, sandbox isolation and server-derived account ID.
-- Serialize issuance per owner; at most 5 intents in ten minutes.
create function play_billing_candidate.issue_test_intent(
 p_owner uuid,p_session uuid,p_account text,p_product text,p_plan text,p_price text,p_currency text
) returns uuid language plpgsql volatile security invoker set search_path='' as $body$
declare id uuid; t timestamptz;
begin
 if p_owner is null or p_session is null then return null; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hoopcheck-play-intent:'||p_owner::text,0));
 t:=clock_timestamp();
 if (select count(*) from play_billing_candidate.purchase_intents where owner_id=p_owner and issued_at>=t-interval '10 minutes')>=5 then return null; end if;
 id:=gen_random_uuid();
 insert into play_billing_candidate.purchase_intents(intent_id,owner_id,session_id,account_id,product_id,base_plan_id,price_micros,currency,issued_at,expires_at)
 values(id,p_owner,p_session,p_account,p_product,p_plan,p_price,p_currency,t,t+interval '60 seconds');
 return id;
end
$body$;
create function play_billing_candidate.consume_test_intent(
 p_id uuid,p_owner uuid,p_session uuid,p_account text,p_product text,p_plan text,p_price text,p_currency text
) returns boolean language plpgsql volatile security invoker set search_path='' as $body$
declare changed integer;
begin
 update play_billing_candidate.purchase_intents
 set consumed_at=clock_timestamp()
 where intent_id=p_id and owner_id=p_owner and session_id=p_session and account_id=p_account
 and product_id=p_product and base_plan_id=p_plan and price_micros=p_price and currency=p_currency
 and consumed_at is null and expires_at>clock_timestamp();
 get diagnostics changed=row_count;
 return changed=1;
exception when check_violation then return false;
end
$body$;
revoke all on function play_billing_candidate.issue_test_intent(uuid,uuid,text,text,text,text,text),play_billing_candidate.consume_test_intent(uuid,uuid,uuid,text,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function play_billing_candidate.issue_test_intent(uuid,uuid,text,text,text,text,text),play_billing_candidate.consume_test_intent(uuid,uuid,uuid,text,text,text,text,text) to service_role;

-- Durable synthetic receipt: not a paid entitlement and not authorization
-- for an actual Google acknowledgment. Immutable, one per refresh generation.
create table play_billing_candidate.test_fulfillments (
 environment text not null check(environment='test'),
 package_name text not null check(package_name='online.hoopcheck.app'),
 fingerprint text not null,
 generation bigint not null check(generation>0),
 owner_id uuid not null,
 product_id text not null check(product_id in ('hoopcheck.pro','hoopcheck.premium')),
 base_plan_id text not null check(base_plan_id in ('monthly','six-month','annual')),
 expires_at timestamptz not null check(isfinite(expires_at)),
 committed_at timestamptz not null default clock_timestamp(),
 primary key(environment,package_name,fingerprint,generation),
 foreign key(environment,package_name,fingerprint) references play_billing_candidate.purchase_claims(environment,package_name,fingerprint)
);
alter table play_billing_candidate.test_fulfillments enable row level security;
alter table play_billing_candidate.test_fulfillments force row level security;
revoke all on play_billing_candidate.test_fulfillments from public,anon,authenticated,service_role;
grant select,insert on play_billing_candidate.test_fulfillments to service_role;
create policy server_fulfillment_read on play_billing_candidate.test_fulfillments for select to service_role using(true);
create policy server_fulfillment_insert on play_billing_candidate.test_fulfillments for insert to service_role with check(environment='test');

create table play_billing_candidate.owner_holds(
 owner_id uuid primary key, held_at timestamptz not null default clock_timestamp()
);
alter table play_billing_candidate.owner_holds enable row level security;
alter table play_billing_candidate.owner_holds force row level security;
revoke all on play_billing_candidate.owner_holds from public,anon,authenticated,service_role;
grant select,insert on play_billing_candidate.owner_holds to service_role;
create policy held_owner_read on play_billing_candidate.owner_holds for select to service_role using(true);
create policy held_owner_insert on play_billing_candidate.owner_holds for insert to service_role with check(true);

create function play_billing_candidate.confirm_test_fulfillment(
 p_fingerprint text,p_owner uuid,p_generation bigint,p_expiry timestamptz
) returns boolean language sql volatile security invoker set search_path='' as $body$
 select exists(
 select 1 from play_billing_candidate.test_fulfillments f
 join play_billing_candidate.purchase_claims c using(environment,package_name,fingerprint)
 join play_billing_candidate.purchase_observations o using(environment,package_name,fingerprint)
 where f.environment='test' and f.package_name='online.hoopcheck.app' and f.fingerprint=p_fingerprint
 and not exists(select 1 from play_billing_candidate.owner_holds h where h.owner_id=p_owner)
 and f.owner_id=p_owner and c.owner_id=p_owner and f.product_id=c.product_id and f.base_plan_id=c.base_plan_id
 and f.generation=p_generation and o.generation=p_generation and o.completed_generation=p_generation
 and f.expires_at=p_expiry and o.expires_at=p_expiry and f.expires_at>clock_timestamp()
 and o.state in ('pending_ack','eligible_for_reconciliation')
 and o.checked_at between clock_timestamp()-interval '30 minutes' and clock_timestamp()
 )
$body$;
create function play_billing_candidate.commit_test_fulfillment(
 p_fingerprint text,p_owner uuid,p_generation bigint,p_expiry timestamptz
) returns boolean language plpgsql volatile security invoker set search_path='' as $body$
declare product text; plan text;
begin
 -- Lock the current observation against concurrent refresh supersession.
 select c.product_id,c.base_plan_id into product,plan
 from play_billing_candidate.purchase_claims c
 join play_billing_candidate.purchase_observations o using(environment,package_name,fingerprint)
 where c.environment='test' and c.package_name='online.hoopcheck.app' and c.fingerprint=p_fingerprint
 and c.owner_id=p_owner and o.generation=p_generation and o.completed_generation=p_generation
 and o.state in ('pending_ack','eligible_for_reconciliation')
 and o.expires_at=p_expiry and o.expires_at>clock_timestamp()
 and o.checked_at between clock_timestamp()-interval '30 minutes' and clock_timestamp()
 for update of o;
 if not found then return false; end if;
 insert into play_billing_candidate.test_fulfillments(environment,package_name,fingerprint,generation,owner_id,product_id,base_plan_id,expires_at)
 values('test','online.hoopcheck.app',p_fingerprint,p_generation,p_owner,product,plan,p_expiry)
 on conflict(environment,package_name,fingerprint,generation) do nothing;
 return play_billing_candidate.confirm_test_fulfillment(p_fingerprint,p_owner,p_generation,p_expiry);
end
$body$;
revoke all on function play_billing_candidate.confirm_test_fulfillment(text,uuid,bigint,timestamptz),play_billing_candidate.commit_test_fulfillment(text,uuid,bigint,timestamptz) from public,anon,authenticated,service_role;
grant execute on function play_billing_candidate.confirm_test_fulfillment(text,uuid,bigint,timestamptz),play_billing_candidate.commit_test_fulfillment(text,uuid,bigint,timestamptz) to service_role;

-- Exact timestamp returned from durable issuance, not an application clock guess.
create function play_billing_candidate.issue_test_intent_bound(
 p_owner uuid,p_session uuid,p_account text,p_product text,p_plan text,p_price text,p_currency text
) returns jsonb language plpgsql volatile security invoker set search_path='' as $body$
declare id uuid; result jsonb;
begin
 id:=play_billing_candidate.issue_test_intent(p_owner,p_session,p_account,p_product,p_plan,p_price,p_currency);
 if id is null then return null; end if;
 select jsonb_build_object('intentId',intent_id,'expiresAt',floor(extract(epoch from expires_at)*1000)::bigint)
 into result from play_billing_candidate.purchase_intents where intent_id=id and owner_id=p_owner and session_id=p_session;
 return result;
end
$body$;
create function play_billing_candidate.consume_test_intent_bound(
 p_id uuid,p_owner uuid,p_session uuid,p_account text,p_product text,p_plan text,p_price text,p_currency text,p_expiry_ms bigint
) returns boolean language plpgsql volatile security invoker set search_path='' as $body$
declare affected integer;
begin
 update play_billing_candidate.purchase_intents set consumed_at=clock_timestamp()
 where intent_id=p_id and owner_id=p_owner and session_id=p_session and account_id=p_account
 and product_id=p_product and base_plan_id=p_plan and price_micros=p_price and currency=p_currency
 and floor(extract(epoch from expires_at)*1000)::bigint=p_expiry_ms
 and consumed_at is null and expires_at>clock_timestamp();
 get diagnostics affected=row_count; return affected=1;
exception when check_violation then return false;
end
$body$;
-- Notification refresh must carry forward durable fulfilled evidence to the
-- new generation. Never create the first fulfillment from a notification.
create function play_billing_candidate.finish_test_reconciliation(
 p_fingerprint text,p_owner uuid,p_generation bigint,p_state text,p_expiry timestamptz
) returns boolean language plpgsql volatile security invoker set search_path='' as $body$
begin
 if not play_billing_candidate.finish_test_refresh(p_fingerprint,p_owner,p_generation,p_state,p_expiry) then return false; end if;
 if p_state='eligible_for_reconciliation' then
  if not exists(select 1 from play_billing_candidate.test_fulfillments
   where environment='test' and package_name='online.hoopcheck.app' and fingerprint=p_fingerprint
   and owner_id=p_owner and generation<p_generation) then return false; end if;
  return play_billing_candidate.commit_test_fulfillment(p_fingerprint,p_owner,p_generation,p_expiry);
 end if;
 return p_state='inactive';
end
$body$;
revoke all on function play_billing_candidate.issue_test_intent_bound(uuid,uuid,text,text,text,text,text),play_billing_candidate.consume_test_intent_bound(uuid,uuid,uuid,text,text,text,text,text,bigint),play_billing_candidate.finish_test_reconciliation(text,uuid,bigint,text,timestamptz) from public,anon,authenticated,service_role;
grant execute on function play_billing_candidate.issue_test_intent_bound(uuid,uuid,text,text,text,text,text),play_billing_candidate.consume_test_intent_bound(uuid,uuid,uuid,text,text,text,text,text,bigint),play_billing_candidate.finish_test_reconciliation(text,uuid,bigint,text,timestamptz) to service_role;


-- Test-only deletion freeze. No policy duration, legal retention determination,
-- or automatic erasure is implied. Only the reviewed deletion workflow may
-- invoke this transition; production integration is a separate acceptance gate.
create function play_billing_candidate.hold_test_owner(p_owner uuid)
returns boolean language plpgsql volatile security invoker set search_path='' as $body$
begin
 if p_owner is null then return false; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hoopcheck-play-hold:'||p_owner::text,0));
 insert into play_billing_candidate.owner_holds(owner_id) values(p_owner) on conflict do nothing;
 return true;
end
$body$;
-- Serialize all candidate billing writes with an irreversible test owner hold.
create function play_billing_candidate.guard_test_owner_write()
returns trigger language plpgsql volatile security invoker set search_path='' as $body$
declare owner uuid;
begin
 if tg_table_name='purchase_observations' then
  select owner_id into owner from play_billing_candidate.purchase_claims
   where environment=new.environment and package_name=new.package_name and fingerprint=new.fingerprint;
 else owner:=new.owner_id; end if;
 if owner is null then raise exception 'candidate owner unavailable'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hoopcheck-play-hold:'||owner::text,0));
 if exists(select 1 from play_billing_candidate.owner_holds where owner_id=owner) then
  raise exception 'candidate owner unavailable';
 end if;
 return new;
end
$body$;
create trigger hold_claim_write before insert on play_billing_candidate.purchase_claims for each row execute function play_billing_candidate.guard_test_owner_write();
create trigger hold_intent_write before insert or update on play_billing_candidate.purchase_intents for each row execute function play_billing_candidate.guard_test_owner_write();
create trigger hold_observation_write before insert or update on play_billing_candidate.purchase_observations for each row execute function play_billing_candidate.guard_test_owner_write();
create trigger hold_receipt_write before insert on play_billing_candidate.test_fulfillments for each row execute function play_billing_candidate.guard_test_owner_write();
revoke all on function play_billing_candidate.hold_test_owner(uuid),play_billing_candidate.guard_test_owner_write() from public,anon,authenticated,service_role;
grant execute on function play_billing_candidate.hold_test_owner(uuid),play_billing_candidate.guard_test_owner_write() to service_role;

-- Runtime first claim is tied to exactly one consumed intent. Restores may
-- reuse an existing same-owner binding, but cannot allocate another token
-- against an already bound intent. Lock the owner before inspecting intents.
create table play_billing_candidate.intent_purchase_bindings(
 intent_id uuid primary key references play_billing_candidate.purchase_intents(intent_id),
 fingerprint text not null unique check(fingerprint ~ '^[0-9a-f]{64}$'),
 owner_id uuid not null
);
alter table play_billing_candidate.intent_purchase_bindings enable row level security;
alter table play_billing_candidate.intent_purchase_bindings force row level security;
revoke all on play_billing_candidate.intent_purchase_bindings from public,anon,authenticated,service_role;
grant select,insert on play_billing_candidate.intent_purchase_bindings to service_role;
create policy binding_read on play_billing_candidate.intent_purchase_bindings for select to service_role using(true);
create policy binding_write on play_billing_candidate.intent_purchase_bindings for insert to service_role with check(true);
create trigger hold_binding_write before insert on play_billing_candidate.intent_purchase_bindings for each row execute function play_billing_candidate.guard_test_owner_write();
create function play_billing_candidate.claim_bound_test_purchase(
 p_owner uuid,p_account text,p_fingerprint text,p_envelope text,p_product text,p_plan text,p_intent uuid,p_previous text default null
) returns text language plpgsql volatile security invoker set search_path='' as $body$
declare i uuid; existing uuid; result text;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hoopcheck-play-hold:'||p_owner::text,0));
 if exists(select 1 from play_billing_candidate.owner_holds where owner_id=p_owner) then return 'retry'; end if;
 select owner_id into existing from play_billing_candidate.intent_purchase_bindings where fingerprint=p_fingerprint;
 if found then
  if existing<>p_owner then return 'foreign_owner'; end if;
  if not exists(select 1 from play_billing_candidate.intent_purchase_bindings b join play_billing_candidate.purchase_intents t using(intent_id)
    where b.fingerprint=p_fingerprint and t.owner_id=p_owner and t.account_id=p_account and t.product_id=p_product and t.base_plan_id=p_plan) then return 'catalog_conflict'; end if;
  return play_billing_candidate.claim_test_purchase(p_fingerprint,p_owner,1::smallint,p_envelope,p_product,p_plan);
 end if;
 if exists(select 1 from play_billing_candidate.purchase_claims where fingerprint=p_fingerprint and owner_id<>p_owner) then return 'foreign_owner'; end if;
 select t.intent_id into i from play_billing_candidate.purchase_intents t
 where t.intent_id=p_intent and t.owner_id=p_owner and t.account_id=p_account and t.product_id=p_product and t.base_plan_id=p_plan and t.consumed_at is not null
 and not exists(select 1 from play_billing_candidate.intent_purchase_bindings b where b.intent_id=t.intent_id)
 -- Consumed intents are immutable by RLS; the owner advisory lock already serializes binding.
 ;
 if not found then return 'retry'; end if;
 if exists(select 1 from play_billing_candidate.replacement_intents where intent_id=i and (p_previous is null or previous_fingerprint<>p_previous or owner_id<>p_owner))
 or (p_previous is not null and not exists(select 1 from play_billing_candidate.replacement_intents where intent_id=i and previous_fingerprint=p_previous and owner_id=p_owner)) then return 'catalog_conflict'; end if;
 result:=play_billing_candidate.claim_test_purchase(p_fingerprint,p_owner,1::smallint,p_envelope,p_product,p_plan);
 if result not in ('claimed','already_claimed') then return result; end if;
 insert into play_billing_candidate.intent_purchase_bindings(intent_id,fingerprint,owner_id) values(i,p_fingerprint,p_owner);
 return result;
end
$body$;
create function play_billing_candidate.finish_and_fulfill_test_purchase(p_fingerprint text,p_owner uuid,p_generation bigint,p_state text,p_expiry timestamptz)
returns boolean language plpgsql volatile security invoker set search_path='' as $body$
begin
 if p_state not in ('pending_ack','eligible_for_reconciliation') then return false; end if;
 if not exists(select 1 from play_billing_candidate.intent_purchase_bindings where fingerprint=p_fingerprint and owner_id=p_owner) then return false; end if;
 if not play_billing_candidate.finish_test_refresh(p_fingerprint,p_owner,p_generation,p_state,p_expiry) then return false; end if;
 return play_billing_candidate.commit_test_fulfillment(p_fingerprint,p_owner,p_generation,p_expiry);
end
$body$;
revoke all on function play_billing_candidate.claim_bound_test_purchase(uuid,text,text,text,text,text,uuid,text),play_billing_candidate.finish_and_fulfill_test_purchase(text,uuid,bigint,text,timestamptz) from public,anon,authenticated,service_role;
grant execute on function play_billing_candidate.claim_bound_test_purchase(uuid,text,text,text,text,text,uuid,text),play_billing_candidate.finish_and_fulfill_test_purchase(text,uuid,bigint,text,timestamptz) to service_role;
-- Immutable same-owner replacement chain. A reservation does not suppress
-- the predecessor until the successor has acknowledged, fulfilled evidence.
create table play_billing_candidate.purchase_replacements(
 previous_fingerprint text primary key check(previous_fingerprint ~ '^[0-9a-f]{64}$'),
 successor_fingerprint text not null unique check(successor_fingerprint ~ '^[0-9a-f]{64}$'),
 owner_id uuid not null,
 activated boolean not null default false,
 check(previous_fingerprint<>successor_fingerprint)
);
alter table play_billing_candidate.purchase_replacements enable row level security;
alter table play_billing_candidate.purchase_replacements force row level security;
revoke all on play_billing_candidate.purchase_replacements from public,anon,authenticated,service_role;
grant select,insert on play_billing_candidate.purchase_replacements to service_role;
grant update(activated) on play_billing_candidate.purchase_replacements to service_role;
create policy replacement_read on play_billing_candidate.purchase_replacements for select to service_role using(true);
create policy replacement_insert on play_billing_candidate.purchase_replacements for insert to service_role with check(not activated);
create policy replacement_activate on play_billing_candidate.purchase_replacements for update to service_role using(not activated) with check(activated);
create trigger hold_replacement_write before insert or update on play_billing_candidate.purchase_replacements for each row execute function play_billing_candidate.guard_test_owner_write();
create table play_billing_candidate.replacement_intents(
 intent_id uuid primary key references play_billing_candidate.purchase_intents(intent_id),
 owner_id uuid not null,previous_fingerprint text not null check(previous_fingerprint ~ '^[0-9a-f]{64}$'),
 mode text not null check(mode in ('charge_full_price','without_proration'))
);
alter table play_billing_candidate.replacement_intents enable row level security;
alter table play_billing_candidate.replacement_intents force row level security;
revoke all on play_billing_candidate.replacement_intents from public,anon,authenticated,service_role;
grant select,insert on play_billing_candidate.replacement_intents to service_role;
create policy replacement_intent_read on play_billing_candidate.replacement_intents for select to service_role using(true);
create policy replacement_intent_insert on play_billing_candidate.replacement_intents for insert to service_role with check(true);
create trigger hold_replacement_intent before insert on play_billing_candidate.replacement_intents for each row execute function play_billing_candidate.guard_test_owner_write();
create function play_billing_candidate.reserve_test_replacement(p_owner uuid,p_session uuid,p_intent uuid,p_old text,p_account text)
returns text language plpgsql volatile security invoker set search_path='' as $body$
declare chosen text;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hoopcheck-play-hold:'||p_owner::text,0));
 if exists(select 1 from play_billing_candidate.owner_holds where owner_id=p_owner) then return null; end if;
 select case when c.product_id='hoopcheck.pro' and i.product_id='hoopcheck.premium' then 'charge_full_price'
 when c.product_id='hoopcheck.premium' and i.product_id='hoopcheck.pro' then 'without_proration' end into chosen
 from play_billing_candidate.purchase_intents i cross join play_billing_candidate.purchase_claims c
 where i.intent_id=p_intent and i.owner_id=p_owner and i.session_id=p_session and i.account_id=p_account and i.consumed_at is null and i.expires_at>clock_timestamp()
 and c.fingerprint=p_old and c.owner_id=p_owner
 and exists(select 1 from play_billing_candidate.intent_purchase_bindings b join play_billing_candidate.purchase_intents t using(intent_id) where b.fingerprint=p_old and b.owner_id=p_owner and t.account_id=p_account)
 and exists(select 1 from play_billing_candidate.shadow_play_sources s where s.source_id=p_old and s.user_id=p_owner)
 and not exists(select 1 from play_billing_candidate.purchase_replacements where previous_fingerprint=p_old);
 if chosen is null then return null; end if;
 insert into play_billing_candidate.replacement_intents values(p_intent,p_owner,p_old,chosen) on conflict(intent_id) do nothing;
 if not exists(select 1 from play_billing_candidate.replacement_intents where intent_id=p_intent and owner_id=p_owner and previous_fingerprint=p_old and mode=chosen) then return null; end if;
 return chosen;
end
$body$;
revoke all on function play_billing_candidate.reserve_test_replacement(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function play_billing_candidate.reserve_test_replacement(uuid,uuid,uuid,text,text) to service_role;
create function play_billing_candidate.claim_replacement_test_purchase(p_owner uuid,p_account text,p_old text,p_new text,p_envelope text,p_product text,p_plan text,p_intent uuid)
returns text language plpgsql volatile security invoker set search_path='' as $body$
declare result text;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hoopcheck-play-hold:'||p_owner::text,0));
 if p_old=p_new or exists(select 1 from play_billing_candidate.owner_holds where owner_id=p_owner) then return 'catalog_conflict'; end if;
 if not exists(select 1 from play_billing_candidate.intent_purchase_bindings b join play_billing_candidate.purchase_intents t using(intent_id)
 where b.fingerprint=p_old and b.owner_id=p_owner and t.owner_id=p_owner and t.account_id=p_account) then return 'foreign_owner'; end if;
 if exists(select 1 from play_billing_candidate.purchase_replacements where previous_fingerprint=p_old and (successor_fingerprint<>p_new or owner_id<>p_owner)) then return 'catalog_conflict'; end if;
 if exists(select 1 from play_billing_candidate.purchase_replacements where successor_fingerprint=p_new and (previous_fingerprint<>p_old or owner_id<>p_owner)) then return 'catalog_conflict'; end if;
 -- A pre-existing independent successor could create a cycle. Only retry
 -- the exact reserved edge; otherwise the successor must be a new claim.
 if exists(select 1 from play_billing_candidate.purchase_claims where fingerprint=p_new)
 and not exists(select 1 from play_billing_candidate.purchase_replacements where previous_fingerprint=p_old and successor_fingerprint=p_new and owner_id=p_owner) then return 'catalog_conflict'; end if;
 if not exists(select 1 from play_billing_candidate.purchase_replacements where previous_fingerprint=p_old and successor_fingerprint=p_new and owner_id=p_owner)
 and not exists(select 1 from play_billing_candidate.replacement_intents where intent_id=p_intent and owner_id=p_owner and previous_fingerprint=p_old) then return 'catalog_conflict'; end if;
 result:=play_billing_candidate.claim_bound_test_purchase(p_owner,p_account,p_new,p_envelope,p_product,p_plan,p_intent,p_old);
 if result not in ('claimed','already_claimed') then return result; end if;
 insert into play_billing_candidate.purchase_replacements(previous_fingerprint,successor_fingerprint,owner_id)
 values(p_old,p_new,p_owner) on conflict(previous_fingerprint) do nothing;
 return result;
end
$body$;
create function play_billing_candidate.finish_replacement_test_purchase(p_fingerprint text,p_owner uuid,p_generation bigint,p_state text,p_expiry timestamptz,p_previous text)
returns boolean language plpgsql volatile security invoker set search_path='' as $body$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hoopcheck-play-hold:'||p_owner::text,0));
 if not exists(select 1 from play_billing_candidate.purchase_replacements where previous_fingerprint=p_previous and successor_fingerprint=p_fingerprint and owner_id=p_owner) then return false; end if;
 if not play_billing_candidate.finish_and_fulfill_test_purchase(p_fingerprint,p_owner,p_generation,p_state,p_expiry) then return false; end if;
 if p_state='eligible_for_reconciliation' then
  update play_billing_candidate.purchase_replacements set activated=true where previous_fingerprint=p_previous and successor_fingerprint=p_fingerprint and owner_id=p_owner and not activated;
 end if;
 return true;
end
$body$;
revoke all on function play_billing_candidate.claim_replacement_test_purchase(uuid,text,text,text,text,text,text,uuid),play_billing_candidate.finish_replacement_test_purchase(text,uuid,bigint,text,timestamptz,text) from public,anon,authenticated,service_role;
grant execute on function play_billing_candidate.claim_replacement_test_purchase(uuid,text,text,text,text,text,text,uuid),play_billing_candidate.finish_replacement_test_purchase(text,uuid,bigint,text,timestamptz,text) to service_role;
-- Disposable credential purge, separate from ownership erasure. Only a
-- privileged fixture administrator may approve an exact deletion lease.
alter table play_billing_candidate.purchase_claims alter column credential_envelope drop not null;
alter table play_billing_candidate.purchase_claims add column credential_purged_at timestamptz;
alter table play_billing_candidate.purchase_claims add constraint credential_purge_pair check ((credential_envelope is null)=(credential_purged_at is not null));
create function play_billing_candidate.guard_new_test_credential() returns trigger language plpgsql security invoker set search_path='' as $body$
begin
 if new.credential_envelope is null or new.credential_purged_at is not null then raise exception 'candidate credential unavailable'; end if;
 return new;
end
$body$;
revoke all on function play_billing_candidate.guard_new_test_credential() from public,anon,authenticated,service_role;
grant execute on function play_billing_candidate.guard_new_test_credential() to service_role;
create trigger new_test_credential before insert on play_billing_candidate.purchase_claims for each row execute function play_billing_candidate.guard_new_test_credential();
create table play_billing_candidate.credential_cleanup_approvals(
 request_id uuid primary key,owner_id uuid not null,lease_fence uuid not null,policy_version text not null check(length(policy_version) between 1 and 128)
);
alter table play_billing_candidate.credential_cleanup_approvals enable row level security;
alter table play_billing_candidate.credential_cleanup_approvals force row level security;
revoke all on play_billing_candidate.credential_cleanup_approvals from public,anon,authenticated,service_role;
-- SECURITY DEFINER is deliberately limited to the two credential fields.
-- The disposable postgres owner supplies approval; service_role cannot alter it.
create function play_billing_candidate.purge_test_owner_credentials(p_request uuid,p_owner uuid,p_fence uuid,p_policy text)
returns boolean language plpgsql volatile security definer set search_path='' as $body$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hoopcheck-play-hold:'||p_owner::text,0));
 if not exists(select 1 from play_billing_candidate.owner_holds where owner_id=p_owner) or
 not exists(select 1 from play_billing_candidate.credential_cleanup_approvals where request_id=p_request and owner_id=p_owner and lease_fence=p_fence and policy_version=p_policy) then return false; end if;
 update play_billing_candidate.purchase_claims set credential_envelope=null,credential_purged_at=clock_timestamp()
 where owner_id=p_owner and credential_envelope is not null;
 return not exists(select 1 from play_billing_candidate.purchase_claims where owner_id=p_owner and credential_envelope is not null);
end
$body$;
revoke all on function play_billing_candidate.purge_test_owner_credentials(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function play_billing_candidate.purge_test_owner_credentials(uuid,uuid,uuid,text) to service_role;
-- Generation-bound provider metadata; missing evidence remains unknown.
create table play_billing_candidate.lifecycle_metadata(
 fingerprint text not null check(fingerprint ~ '^[0-9a-f]{64}$'),generation bigint not null,
 owner_id uuid not null,provider_state text not null check(provider_state in ('SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_IN_GRACE_PERIOD','SUBSCRIPTION_STATE_CANCELED','SUBSCRIPTION_STATE_EXPIRED','SUBSCRIPTION_STATE_PENDING','SUBSCRIPTION_STATE_PAUSED','SUBSCRIPTION_STATE_ON_HOLD','SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED')),
 auto_renew_enabled boolean,period_end timestamptz not null check(isfinite(period_end)),primary key(fingerprint,generation),
 check(provider_state<>'SUBSCRIPTION_STATE_CANCELED' or auto_renew_enabled is distinct from true)
);
alter table play_billing_candidate.lifecycle_metadata enable row level security;
alter table play_billing_candidate.lifecycle_metadata force row level security;
revoke all on play_billing_candidate.lifecycle_metadata from public,anon,authenticated,service_role;
grant select,insert on play_billing_candidate.lifecycle_metadata to service_role;
create policy lifecycle_read on play_billing_candidate.lifecycle_metadata for select to service_role using(true);
create policy lifecycle_insert on play_billing_candidate.lifecycle_metadata for insert to service_role with check(true);
create trigger hold_metadata_write before insert on play_billing_candidate.lifecycle_metadata for each row execute function play_billing_candidate.guard_test_owner_write();
create function play_billing_candidate.finish_test_runtime_lifecycle(p_fp text,p_owner uuid,p_gen bigint,p_state text,p_expiry timestamptz,p_provider text,p_renew boolean,p_period timestamptz,p_previous text,p_mode text)
returns boolean language plpgsql volatile security invoker set search_path='' as $body$
declare ok boolean;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hoopcheck-play-hold:'||p_owner::text,0));
 if p_provider is not null and (p_period is null or (p_expiry is not null and p_period<>p_expiry)) then return false; end if;
 if p_mode='notification' then
  ok:=play_billing_candidate.finish_test_reconciliation(p_fp,p_owner,p_gen,p_state,p_expiry);
 elsif p_mode='fulfill' and p_previous is not null then
  ok:=play_billing_candidate.finish_replacement_test_purchase(p_fp,p_owner,p_gen,p_state,p_expiry,p_previous);
 elsif p_mode='fulfill' then
  ok:=play_billing_candidate.finish_and_fulfill_test_purchase(p_fp,p_owner,p_gen,p_state,p_expiry);
 else return false; end if;
 if not coalesce(ok,false) then return false; end if;
 if p_provider is not null then
  insert into play_billing_candidate.lifecycle_metadata values(p_fp,p_gen,p_owner,p_provider,p_renew,p_period);
 end if;
 -- A notification may finish a previously reserved, acknowledged successor.
 if p_mode='notification' and p_state='eligible_for_reconciliation' and play_billing_candidate.confirm_test_fulfillment(p_fp,p_owner,p_gen,p_expiry) then
  update play_billing_candidate.purchase_replacements set activated=true where successor_fingerprint=p_fp and owner_id=p_owner and not activated;
 end if;
 return true;
end
$body$;
revoke all on function play_billing_candidate.finish_test_runtime_lifecycle(text,uuid,bigint,text,timestamptz,text,boolean,timestamptz,text,text) from public,anon,authenticated,service_role;
grant execute on function play_billing_candidate.finish_test_runtime_lifecycle(text,uuid,bigint,text,timestamptz,text,boolean,timestamptz,text,text) to service_role;
commit;
