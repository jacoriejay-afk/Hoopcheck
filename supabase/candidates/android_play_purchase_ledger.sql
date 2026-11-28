-- Candidate ONLY. Do not apply to a hosted database or migration ledger.
-- Standalone test purchase ownership, deliberately not an entitlement source.
begin;
create schema play_billing_candidate;
revoke all on schema play_billing_candidate from public, anon, authenticated, service_role;
grant usage on schema play_billing_candidate to service_role;

create table play_billing_candidate.purchase_claims (
  environment text not null check (environment = 'test'),
  package_name text not null check (package_name = 'online.hoopcheck.app'),
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  owner_id uuid not null,
  credential_version smallint not null check (credential_version = 1),
  credential_envelope text not null check (
    length(credential_envelope) between 55 and 5600
    and credential_envelope ~ '^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$'
  ),
  product_id text not null check (product_id in ('hoopcheck.pro','hoopcheck.premium')),
  base_plan_id text not null check (base_plan_id in ('monthly','six-month','annual')),
  created_at timestamptz not null default clock_timestamp(),
  primary key (environment, package_name, fingerprint)
);
alter table play_billing_candidate.purchase_claims enable row level security;
alter table play_billing_candidate.purchase_claims force row level security;
revoke all on play_billing_candidate.purchase_claims from public, anon, authenticated, service_role;
-- Trusted server role may insert/read only; never update/reassign/delete.
grant select, insert on play_billing_candidate.purchase_claims to service_role;
create policy service_read_claim on play_billing_candidate.purchase_claims
  for select to service_role using (true);
create policy service_insert_claim on play_billing_candidate.purchase_claims
  for insert to service_role with check (environment = 'test' and package_name = 'online.hoopcheck.app');

-- Only a server that has verified Google, the owner, current session/MFA,
-- deletion freeze, purchase intent and allowed catalog may invoke this.
-- Returns a status only. ON CONFLICT never rewrites the existing claim.
create function play_billing_candidate.claim_test_purchase(
  p_fingerprint text, p_owner_id uuid, p_credential_version smallint,
  p_credential_envelope text, p_product_id text, p_base_plan_id text
) returns text
language plpgsql volatile security invoker set search_path = ''
as $claim$
declare
  existing_owner uuid;
  existing_product text;
  existing_plan text;
  inserted integer;
begin
  insert into play_billing_candidate.purchase_claims
    (environment, package_name, fingerprint, owner_id, credential_version, credential_envelope, product_id, base_plan_id)
    values ('test','online.hoopcheck.app',p_fingerprint,p_owner_id,p_credential_version,p_credential_envelope,p_product_id,p_base_plan_id)
    on conflict (environment, package_name, fingerprint) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 1 then return 'claimed'; end if;
  select owner_id, product_id, base_plan_id
    into existing_owner, existing_product, existing_plan
    from play_billing_candidate.purchase_claims
    where environment = 'test' and package_name = 'online.hoopcheck.app' and fingerprint = p_fingerprint;
  if not found then return 'retry'; end if;
  if existing_owner is distinct from p_owner_id then return 'foreign_owner'; end if;
  if existing_product is distinct from p_product_id or existing_plan is distinct from p_base_plan_id
    then return 'catalog_conflict'; end if;
  return 'already_claimed';
end;
$claim$;
revoke all on function play_billing_candidate.claim_test_purchase(text,uuid,smallint,text,text,text) from public, anon, authenticated, service_role;
grant execute on function play_billing_candidate.claim_test_purchase(text,uuid,smallint,text,text,text) to service_role;
commit;
