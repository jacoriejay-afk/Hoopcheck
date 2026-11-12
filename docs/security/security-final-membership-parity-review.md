# SECURITY-FINAL — membership RPC production-to-candidate parity review

Read-only comparison performed 2026-11-12 against `pg_get_functiondef(public.admin_set_membership(uuid,text))`.

## Confirmed changes

- Current production authorization calls `public.is_current_user_admin_or_moderator()`. This explicitly allows moderators to assign local membership; the candidate instead checks `public.admin_roles` for the exact `admin` role and raises SQLSTATE 42501.
- Candidate rejects NULL plans explicitly, in addition to values outside free/pro/premium.
- Candidate uses empty function search_path, with explicit `public.` and `auth.` schema qualifiers.
- Candidate explicitly revokes PUBLIC/anon EXECUTE and grants authenticated EXECUTE. Production grants authenticated EXECUTE and not anon (read-only privilege check).

## Preserved behavior, checked line-by-line

- Stripe-linked rows are rejected when `stripe_subscription_id` is nonblank.
- `free` clears local access and Stripe identifiers only for unlinked subscriptions.
- `pro` and `premium` upsert active local access with a one-year end date.
- Existing `billing_interval='year'`, `cancel_at_period_end=false`, and `updated_at` behavior is retained.
- Return type and function arguments remain boolean / (uuid,text).

## Unverified integration requirements

- Run the candidate in an isolated PostgreSQL/Supabase environment with representative auth contexts.
- Admin: free/pro/premium changes succeed and target only the requested account.
- Moderator, ordinary authenticated user, and anonymous user: no mutation; 42501 or permission denied.
- Stripe-linked subscription: no mutation, error returned.
- Invalid and NULL plans: 22023; no mutation.
- Verify all application admin UI call sites and membership cache refresh.
- Check whether local subscription updates require a related entitlement refresh; avoid changing Stripe webhook logic.

This document records a read-only source comparison, **not** execution of the candidate or an authorization penetration test. Do not merge or apply the candidate until the integration tests pass.
