-- Read-only production/staging preflight for admin_set_membership.
-- Requires a separate isolated test fixture to exercise mutations.
do $$
declare
  v_oid oid;
  v_definition text;
begin
  select p.oid, pg_get_functiondef(p.oid) into v_oid, v_definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='admin_set_membership'
    and pg_get_function_identity_arguments(p.oid)='p_user_id uuid, p_plan text';
  if v_oid is null then raise exception 'membership RPC missing'; end if;
  if not (select p.prosecdef from pg_proc p where p.oid=v_oid) then
    raise exception 'membership RPC must be security definer';
  end if;
  if has_function_privilege('anon',v_oid,'EXECUTE') then
    raise exception 'anonymous users can invoke membership RPC';
  end if;
  if not has_function_privilege('authenticated',v_oid,'EXECUTE') then
    raise exception 'authenticated RPC grant missing';
  end if;
  if position('Only admins can manage memberships' in v_definition)=0
    or position('public.admin_roles' in v_definition)=0 then
    raise exception 'admin-only authorization guard missing';
  end if;
  if position('stripe_subscription_id' in v_definition)=0 then
    raise exception 'Stripe subscription protection missing';
  end if;
end $$;

-- Isolated test environment only: execute with real authenticated fixture JWTs.
-- Moderator and ordinary user: expect SQLSTATE 42501 and unchanged subscription.
-- Admin with non-Stripe fixture: expect successful grant inside rollback transaction.
-- Admin with Stripe-linked fixture: expect exception and unchanged subscription.
-- Verify free/pro/premium paths, and that no real customer rows are changed.
