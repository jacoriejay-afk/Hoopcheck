-- REVIEW-ONLY token vault; not an applied migration.
-- Requires reviewed private function ownership and a deletion worker.
create schema if not exists hoopcheck_apple_private;
revoke all on schema hoopcheck_apple_private from public,anon,authenticated,service_role;
grant usage on schema hoopcheck_apple_private to service_role;
create table if not exists hoopcheck_apple_private.authorization_vault (
  owner_id uuid not null,
  apple_subject text not null,
  encrypted_refresh_token text not null check(length(encrypted_refresh_token) between 20 and 12000),
  updated_at timestamptz not null default now(),
  primary key(owner_id,apple_subject)
);
alter table hoopcheck_apple_private.authorization_vault enable row level security;
revoke all on hoopcheck_apple_private.authorization_vault from public,anon,authenticated,service_role;
create function hoopcheck_apple_private.store_authorization(p_owner uuid,p_session uuid,p_subject text,p_envelope text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_owner is null or p_session is null or p_subject is null or length(p_subject) not between 1 and 255
     or p_envelope is null or length(p_envelope) not between 20 and 12000 or p_envelope !~ '^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'
  then raise exception 'Invalid authorization' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text,17001));
  if not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
    join auth.identities i on i.user_id=u.id
    where s.id=p_session and s.user_id=p_owner and (s.not_after is null or s.not_after>now())
      and u.email_confirmed_at is not null and u.role in ('authenticated','hoopcheck_pending_signup')
      and i.provider='apple' and i.provider_id=p_subject)
  then raise exception 'Verified Apple session required' using errcode='42501'; end if;
  insert into hoopcheck_apple_private.authorization_vault(owner_id,apple_subject,encrypted_refresh_token)
    values(p_owner,p_subject,p_envelope)
    on conflict(owner_id,apple_subject) do update set encrypted_refresh_token=excluded.encrypted_refresh_token,updated_at=now();
  return true;
end $$;
revoke all on function hoopcheck_apple_private.store_authorization(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function hoopcheck_apple_private.store_authorization(uuid,uuid,text,text) to service_role;
create function public.store_verified_apple_authorization(p_owner uuid,p_session uuid,p_subject text,p_envelope text)
returns boolean language sql security invoker set search_path='' as $$
  select hoopcheck_apple_private.store_authorization(p_owner,p_session,p_subject,p_envelope)
$$;
revoke all on function public.store_verified_apple_authorization(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.store_verified_apple_authorization(uuid,uuid,text,text) to service_role;
-- No public token-reading RPC, no plaintext token, no cascade on auth.users:
-- the finalizer must revoke first, acknowledge revocation, then remove vault rows.
