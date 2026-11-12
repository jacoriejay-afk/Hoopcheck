# SECURITY-FINAL — admin_roles and privileged RPC production verification

Read-only inspection of production catalog, 2026-11-12:

- `public.admin_roles` has RLS enabled, FORCE RLS disabled.
- Its only observed policy is authenticated SELECT `admin_roles_own_read`, restricted to `user_id = auth.uid()`.
- `admin_set_membership(uuid,text)`: SECURITY DEFINER, search_path=public, EXECUTE authenticated=true, anon=false.
- `admin_set_user_role(uuid,text)`: SECURITY DEFINER, search_path=public,pg_catalog, EXECUTE authenticated=true, anon=false.
- `is_current_user_admin_or_moderator()`: SECURITY INVOKER, authenticated=true, anon=false.

**Implication:** The candidate's `admin_roles` exact-admin check is consistent with existing `admin_set_user_role` authorization. The candidate remains SECURITY DEFINER; its role lookup should be tested in an isolated database, especially if the function owner or table owner differs. No assumption of successful authorization was made based solely on catalog metadata.

**Open:** Test role impersonation with real authenticated JWTs, negative cases, Stripe-linked account preservation, and application entitlements. Catalog reads do not validate those behaviors.

No production SQL mutation performed.
