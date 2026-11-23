# Build 9 — legacy RPC compatibility inventory (2026-11-23)

**Disposition: READ-ONLY DEVELOPMENT EVIDENCE — PRODUCTION RELEASE HOLD.**

Protected source base at creation: `c63a7ce156a34a1565c6be1a6982faea871d0adb`. The exact committed blob `2a20fb65dd1a52618a27b987862ffd3623360883` of [`supabase/tests/build9_legacy_rpc_compatibility_readonly.sql`](../../../supabase/tests/build9_legacy_rpc_compatibility_readonly.sql) was fetched back and successfully executed **unchanged** against both existing PostgreSQL 17.11 projects. It begins `BEGIN TRANSACTION READ ONLY`, selects only `pg_proc` / ACL metadata, and rolls back. It does not query user records or JWTs.

## Reproducible inventory

| Contract | Production HoopCheck | PR17-Test fixture |
| --- | --- | --- |
| Legacy `get_public_player_profile(uuid)` | Installed; `postgres` owner; SECURITY INVOKER | Installed but DIFFERENT owner (`hoopcheck_public_profile_reader`), SECURITY DEFINER, different source digest |
| `search_public_players(text,text,text,boolean,integer)` | Installed; all five parameters retain defaults | **Missing** |
| `search_public_players_page(text,text,text,boolean,integer,integer)` | Installed; all six parameters retain defaults | **Missing** |
| Build 8 username discovery RPC | Installed; three optional parameters | **Missing** |
| Build 8 country consent RPC | Installed | **Missing** |
| Build 9 `get_own_profile()` | **Missing** | **Missing** |
| Build 9 `hoopcheck_security.mfa_satisfied()` | **Missing** | **Missing** |
| `fan_live_chat_room_open(uuid)` | Installed; authenticated EXECUTE, anon denied; SECURITY DEFINER | Installed, but different function source digest |

Production's five legacy/Build8 player functions are SECURITY INVOKER and executable by `anon` and `authenticated` (not by PUBLIC through an explicit PUBLIC ACL grant). This confirms **catalog presence, signatures, grants and default arguments only**. It is **NOT proof** that an installed Build 7/8 app can use every response, or that RLS/privacy is safe for real users.

In particular, the PR17-Test fixture is **not** an acceptable substitute for a production-equivalent rehearsal. The separate, previously checked [full parity inventory](../../../supabase/tests/build9_pg17_schema_parity_readonly.sql) found **203 vs 48 migrations, 211 vs 66 public policies, and a missing `fan_live_chat_messages` table** in the test fixture. Production has raw direct-country SELECT grants that require a compatible, reviewed privacy transition. Do not change ownership or enable postgame chat to mask this mismatch.

## Exact next acceptance handoff

1. An authorized database operator obtains a **schema/roles-only** production PostgreSQL 17 snapshot using Supabase-supported CLI procedures and stores it privately. Do not export any customer rows, `auth.users`, payment data, database connection strings, or secrets into the repo or logs. Read [Supabase restore/export guidance](https://supabase.com/docs/guides/self-hosting/restore-from-platform).
2. Restore a **disposable, cost-approved** PostgreSQL 17 environment, retaining original function-owner, ACL, extension, policy, trigger, default-argument and schema semantics. Re-run this exact inventory plus `build9_pg17_schema_parity_readonly.sql`. Any drift is a stop signal, not something to “fix” by changing reference digests.
3. Review `20261118162305_player_profile_country_privacy.sql`, `20261119074537_profile_private_field_boundary.sql`, follow-up dependencies, protected ownership and rollback against that accurate baseline. The PR17-specific `hoopcheck_public_profile_reader` ownership candidate must **not** be transplanted to production's postgres-owned SECURITY INVOKER function. Never force owner elevation or weaken RLS to get a green test.
4. Before any restrictive grants, test **real signed anonymous and Free/Pro/Premium/admin owner/nonowner AAL1/AAL2**, visibility/blocked/suspended/opt-out/moderation, and allowed/denied private reads and edits over HTTP. The existing `scripts/build9-signed-http-acceptance.mjs` is deliberately pinned to the PR17 fixture; do not repoint it at production. Prepare a separately reviewed production-equivalent test harness and disposable JWT fixtures.
5. Verify **installed** Build 7 and Build 8 request/response and startup compatibility, plus physical Build 9 iPhone and Apple Sandbox purchase/restore/trial/cancel/refund. Only then review phase-2 private-column permission restrictions and any versioned migration/rollback.

Production postgame chat SQL remains review-only and `NEXT_PUBLIC_LIVE_POSTGAME_CHAT_ENABLED` stays OFF. No production SQL, ACL, RLS, Stripe, Auth setting, team seed, deployment, EAS, or TestFlight action is approved by this artifact. PR #755 must remain DRAFT/HOLD until all external acceptance evidence exists.

## How to re-run

After verifying the authorized project environment and read-only access, run **the identical SQL file** in each environment via a reviewed query runner and compare every returned field. Do not treat a raw function ACL or synthetic role claim as signed-user security acceptance; see [Supabase RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security).
