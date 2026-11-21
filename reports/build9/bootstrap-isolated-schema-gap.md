# Build 9 — isolated bootstrap dependency gate (2026-11-21)

Reviewed `app/api/mobile/bootstrap/route.ts` from PR #747 baseline `658584a9`. The route verifies a bearer token then requires all three backend reads to succeed: owner `profiles` projection, `membership_entitlements` projection, and `get_current_user_admin_role()` RPC. Any dependency error yields HTTP 503.

## Read-only isolated Supabase findings
- `public.membership_entitlements`: **MISSING** (`to_regclass` returned null).
- `public.get_current_user_admin_role()`: PRESENT.
- `public.get_own_profile()`: **MISSING** (the unapplied profile migration defines it).
- `authenticated` has SELECT privileges for `profiles.account_type`, `display_name`, `player_verified`.
- Earlier audit: MFA helper, canonical profile boundary, and restrictive policies are missing.

## Implication
The isolated database is **not an adequate end-to-end bootstrap test environment**. Running a player/fan/admin membership acceptance matrix here would conflate missing test schema with application behavior. This finding does not prove production has the same gap.

## No-cost next steps
1. Inspect the existing repository migration that defines `membership_entitlements`, including dependencies, grants, RLS, and compatibility.
2. Compare **read-only** schema signatures with production if authorized and available; do not modify production.
3. Use unit tests with mocked Supabase calls for bootstrap's 401/409/503/200 response contracts while environment parity is unresolved.
4. Do not add ad hoc production-like tables to the isolated project or run global MFA policies without a verified restore point.
5. Restore environment parity through a reviewed, owner-approved isolated-only procedure before claiming live bootstrap acceptance.

Status: **BLOCKED for live isolated bootstrap integration**; Build 9 remains NO-GO.
