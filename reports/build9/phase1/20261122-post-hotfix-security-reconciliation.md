# Build 9 Phase 1 — post-hotfix privacy/security reconciliation (2026-11-22)

**Disposition: Phase 1 legacy-RPC masking is installed and catalog-verified; Build 9 backend release remains HOLD.** This report is read-only evidence, **not** production migration approval, complete privacy protection, TestFlight acceptance, or an authenticated user test.

## Verified isolated findings

| Check | HoopCheck production `ucbdceaieyenljcwlhnj` | PR17 isolated test `vcprqpjkyubzzcjatdpx` |
| --- | --- | --- |
| PostgreSQL | 17.11 | 17.11 |
| Recorded migrations at check | **199** | **47** |
| Newest relevant production privacy migration | `20261122032844_legacy_player_privacy_mask_phase1_20261122` **installed** | **not installed** |
| `public.get_public_player_profile(uuid)` owner | `postgres` | `hoopcheck_public_profile_reader` |
| Function execution | `SECURITY INVOKER`, `search_path=public` | `SECURITY DEFINER`, empty search path |
| Protected-owner runner available in this connection | Production `postgres` owns the *different* legacy invoker | **NO**: current `postgres` cannot inherit/SET restricted owner |
| Follow/block prerequisites | Present | Missing |
| `get_own_profile()` and MFA helper | Absent | Absent |
| Direct `current_country` SELECT granted to `anon` | **Yes** | No |
| Direct `current_country` SELECT granted to `authenticated` | **Yes** | Yes |

### Production legacy RPC hotfix is present

PR [#789](https://github.com/jacoriejay-afk/Hoopcheck/pull/789) was merged, and the matching **versioned migration is recorded on production**. Read-only `pg_proc` inspection confirmed all three expected post-hotfix source hashes:

| Installed signature | Source MD5 |
| --- | --- |
| `get_public_player_profile(uuid)` | `d9cd27d5b6e426397674d48184530b24` |
| `search_public_players(text,text,text,boolean,integer)` | `c2eee54d975b81dfeea139cacc2b8bee` |
| `search_public_players_page(text,text,text,boolean,integer,integer)` | `9645a81f5e34e52e95946744ba05c9d1` |

Source inspection found the legacy search functions mask opted-out `current_country` in results **and** query/filter matching, and suppress unapproved avatar URLs. The public detail RPC has an existing owner exception for opt-out country and still uses legacy players-only visibility; that behavior is *not* equivalent to the restricted PR17 implementation. No live personally identifiable rows were read or changed during this audit.

**Read-only production RLS policy inventory:** `profiles_public_read` gives `anon` SELECT for `profile_visibility='public'`; `profiles_authenticated_read` gives `authenticated` SELECT for public or own rows (and authorized admin/moderator); and `profiles_own_update` limits UPDATE to `auth.uid()=id` in both USING and WITH CHECK. Since both request roles also hold column-level SELECT on `current_country`, **direct Data API SELECT on publicly visible profile rows can bypass the new legacy-RPC country masking**. RLS controls *which rows*, not masking an individual opted-out column. This is an unresolved privacy exposure; no actual user rows were queried to demonstrate it.

### Automated read-only regression gate

New file: [production-post-hotfix-catalog-guard.sql](./production-post-hotfix-catalog-guard.sql).

- Ran the **exact committed SQL** against production in `BEGIN TRANSACTION READ ONLY`: **PASS_POST_HOTFIX_IDENTITY_ONLY**, 199 migrations, both raw-country grants still `true`.
- Ran the **same exact committed SQL** against PR17 isolated test in a read-only transaction: expected fail-closed exception `Missing Phase 1 hotfix migration, profile RLS, or production follow/block prerequisites`.
- It verifies current profile RLS, follow/block prerequisites, the recorded hotfix version, legacy RPC owner/security mode/config/EXECUTE grants/source fingerprints, and the expected absent APIs. It deliberately refuses unexpected changes.
- The prior [production-catalog-guard.sql](../integration/production-catalog-guard.sql) captures the **pre-hotfix** baseline and is **intentionally unchanged**. Its old fingerprints should now fail, not be silently rewritten to pass.

**Passing this guard proves only that the expected pre-Build 9 post-hotfix catalog identity remains installed.** It is not a runtime consent, authorization or direct-table-read test.

### Security advisor inventory (read-only)

- **Production:** four advisor categories: 15 informational RLS-without-policy entries, 4 anonymous callable SECURITY DEFINER functions and 36 authenticated callable SECURITY DEFINER functions. Each function requires per-item authorization review, not a blanket revocation. [Supabase database linter](https://supabase.com/docs/guides/database/database-linter).
- **Isolated PR17:** five advisor categories, including **two ERROR-level RLS-disabled public tables** (`feed_posts`, `support_tickets`) in that **test project**; also callable definer warnings and disabled leaked-password protection. Do not conflate these test-only findings with production configuration. [RLS disabled guidance](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public).

## Phase 1 exit gates — NOT satisfied

1. **Authorized production-schema-equivalent rehearsal:** export schema/roles only using the [existing runbook](../integration/production-schema-reconciliation-handoff.md); preserve installed ownership, RLS and grants, and test on disposable PostgreSQL 17 with the post-hotfix 199-migration baseline. Never treat the 47-migration PR17 project as a production clone.
2. **PR17 scoped-owner handoff:** only an already authorized owner-capable migration executor may replace `hoopcheck_public_profile_reader`'s restricted SECURITY DEFINER function. Current connection lacks that capability. The PR17-only candidate `supabase/candidates/20261121103148_reconcile_scoped_public_player_profile.sql` must **not** run against production. No new owner grants, forced function ownership, bypass-RLS, broader policies, or source-hash substitutions.
3. **Genuine signed HTTP acceptance:** disposable owner/non-owner accounts and owner AAL1/AAL2 *real Auth-issued JWTs*. Test country opt-in/out, profile visibility, suspended players, avatar approval, negative cross-account reads/edits, public search and owner MFA. The existing [signed HTTP runbook](../integration/signed-http-acceptance-runbook.md) is pinned to PR17 and cannot be claimed as a production-schema acceptance result; no real sessions were available in this audit.
4. **Installed Build 7/8 compatibility:** recover the exact outgoing API requests from installed binaries/physical iPhones, especially direct raw profile column reads, before any `REVOKE SELECT` or privacy-policy tightening. Build 7 source is still unavailable in GitHub. No synthetic claim, browser fixture or new Build 9 client can replace this check.
5. **No automatic rollout:** the staged owner/private-field/RLS candidates require reviewed dependency order, rollback and negative tests. Do not merge draft release PR [#755](https://github.com/jacoriejay-afk/Hoopcheck/pull/755), apply migrations, deploy Build 9 or start EAS on this evidence.

## Exact authorized handoff

An authorized project operator should provide a **redacted schema-only/roles-only export to a disposable Postgres 17 rehearsal environment**, supported owner-capable execution path for PR17, and real disposable test-user sessions for AAL1/AAL2 negative cases. Do not send database URIs, JWTs, keys, user data, or raw dumps in GitHub/chat. If ownership cannot be assumed through existing approved privileges, ask Supabase Support for the supported path.

**Scope protection:** no production DDL, table grants, RLS, customer records, billing, trial rules, Stripe data, native release, EAS, or live deployment changed in this reconciliation. Existing production privacy hotfix was observed, not re-applied.
