# Build 9: production-schema reconciliation and guarded release handoff

**Decision: HOLD production database rollout.** This records a read-only catalog comparison, not a migration, a production-schema dump, a data scan or physical iOS acceptance. Scope: HoopCheck Build 9 / PR #755. No production data, subscriptions, billing records, grants or table definitions were changed.

## Verified production identity

The operator-confirmed **production** Supabase project reference is `ucbdceaieyenljcwlhnj`. The separate isolated project `vcprqpjkyubzzcjatdpx` is a purpose-built PR17 test fixture, **not** a schema-equivalent clone.

The reviewed catalog guard `reports/build9/integration/production-catalog-guard.sql` was executed as a **READ ONLY** transaction on production, with no error, and intentionally **failed** on PR17-Test with missing prerequisites. It checks four known function signatures, installed source fingerprints, function ownership, security mode/search_path, intended EXECUTE privileges, profile RLS, and follow/block prerequisites.

| Baseline at inspection | Production | PR17-Test |
| --- | --- | --- |
| Recorded migrations | 199 as of 2026-11-22 phase-1 hotfix | 38 at prior inspection |
| Public player RPC owner | `postgres` | `hoopcheck_public_profile_reader` |
| Public player RPC mode | SECURITY INVOKER, `search_path=public` | restricted SECURITY DEFINER, empty search_path |
| `follow_relationships` / `user_blocks` | both exist | neither exists |
| Public follow-list function | exists | absent |
| `get_own_profile()`, MFA helper, username search, consent helper | absent | absent |
| Anonymous direct SELECT privilege on `profiles.current_country` | granted | not granted |

**2026-11-22 update:** production legacy `get_public_player_profile`, `search_public_players` and `search_public_players_page` now mask opted-out `current_country` (in results and search predicates), plus pending/unapproved avatars. Phase-1 production migration `20261122032844` passed post-deployment catalog and anonymous read-only smoke checks. **The direct `public.profiles.current_country` SELECT grants still expose the raw location column to `anon` and `authenticated`**, and `get_own_profile()` is not installed. This is a remaining **phase-2 privacy rollout blocker**, not a reason to revert the phase-1 masking hotfix. The repository's as-yet-unapplied `20261118162305_player_profile_country_privacy.sql` and `20261119074537_profile_private_field_boundary.sql` contain reviewed masked versions, username discovery and consent APIs, but are **not installed** on production.

## Exact safe handoff

1. **Export schema only.** An authorized operator should produce a schema-only PostgreSQL dump of the production database to a tightly controlled local environment, without copying any user rows. Preserve owner and grants for review, redact credentials and secrets, and do not publish an unreviewed dump as a PR artifact. A database-connection URI must never be pasted into GitHub, logs, or chat. If the operator cannot obtain an authorized schema-only export, request the supported procedure from Supabase Support.
**Supabase-supported, schema-only export commands (on an authorized local workstation with Docker and the CLI):**

```sh
# Supply HOOPCHECK_PROD_DB_URL via the local secret manager; do not paste
# the connection string into chat, GitHub, shell history or CI logs.
supabase db dump --db-url "$HOOPCHECK_PROD_DB_URL" -f schema.sql
supabase db dump --db-url "$HOOPCHECK_PROD_DB_URL" -f roles.sql --role-only
```

Do **not** run `--data-only` or export `auth.users`, customer records or storage files. Review the schema and roles outputs locally before sharing any sanitized evidence. Supabase's CLI wraps `pg_dump` with Supabase-specific filtering and requires Docker; unlike a raw `pg_dump` it may omit internal schemas and managed roles, so the separate read-only catalog inventory remains necessary. See [Supabase's official restore/export guide](https://supabase.com/docs/guides/self-hosting/restore-from-platform).

2. **Rehearse on disposable PostgreSQL 17 using the production schema**, not the PR17 fixture. Restore relevant owner/ACL/RLS context for the rehearsal without granting elevated capabilities to hosted application roles. Verify the exact migration order, full dependency graph and pre/post catalog signatures. Compare with repository `20261118162305`, `20261118162456`, `20261119074537`, `20261119075626` and the guarded editor candidate `supabase/candidates/build9_native_profile_editor_write.sql`. Do not replay unreviewed historical migrations over the live schema.
3. **Separate execution paths:** The protected-reader reconciliation candidate `supabase/candidates/20261121103148_reconcile_scoped_public_player_profile.sql` assumes PR17-Test's existing scoped owner and exact source fingerprint. It must **never** be applied to production's differently owned/invoked function. For the PR17 isolated fixture the current `postgres` runner cannot SET or USE the protected owner; obtain an **existing authorized owner-capable executor** through the project operator/official Supabase support. Do not make one by changing ownership or granting elevated roles.
4. **Stage backwards-compatible public API additions first**, preserving legacy five/six-parameter player search and their defaults, men's directory behavior, username search, and current country consent logic. Test masked outputs **and search predicates**, suspended users, avatar moderation, private players, unrelated authenticated users, anonymous Auth, and real JWT AAL1/AAL2. Then validate installed Build 7 and Build 8 requests on physical devices. Only after this evidence can private column grants be restricted. Maintain membership entitlement, StoreKit/Stripe source separation and 7-day monthly trial eligibility.
5. **Release gates:** Collect redacted pass/fail results from `scripts/build9-signed-http-acceptance.mjs` (restricted to PR17-Test) and separate authentic production-like rehearsal HTTP tests, including owner/nonowner private edit and cross-account negative cases. Verify iPhone startup freeze/scrolling, OAuth/Face ID, PDF sharing and cleanup, signed bundle ID/build number, Apple Sandbox six-term purchases and trial/renewal/restore/cancel/refund, plus legacy installed-client compatibility. Simulator tests, browser CI and synthetic database claims cannot close these gates.
6. **Re-run this read-only guard immediately before the reviewed production migration.** If it fails, stop and re-review the source baseline; never update fingerprints just to pass a deployment. A passing guard confirms the captured **pre-migration** identity only, not safety or acceptance of new functions.

## Scope and disposition

This work makes the production-vs-test mismatch reproducible and rejects stale schema identities, but **does not replace a complete schema-only export** or run an authorized production migration. GitHub PR #755 stays draft; do not merge to main, deploy, run EAS, change production roles or modify billing until signed acceptance is recorded. Production customer data is left untouched.
