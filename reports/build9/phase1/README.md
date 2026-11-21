# Build 9 Phase 1 — 2026-11-20

DRAFT / RELEASE BLOCKED. No production operation, migration push, merge, deployment, EAS, signing or Apple activation is authorized or performed.

## Reconciliation

Separate branch `reconcile/build9-phase1-20261120` starts at dependency PR #745 head `97f5c36654c4148345b36d8cf151ea32374ab7be`. This includes RPC bridge/anonymous username repair `13281b12`, Build 9 #744 head `db5c0063`, Build 8 #741 head `c0b77ba3`, player-search privacy #736 `8ece4ff8`, (ancestry verified). Independent direct-profile privacy audit #739 `3cd0cdf1` was inspected separately; it is not an ancestor. Its alternate owner-country/feed/directory migrations must not be stacked blindly onto the consolidated five: the consolidated private-field boundary supplies get_own_profile, public-player projections and the full can_view_player_feed_post boundary. The audit’s deployment/legacy-reader restrictions remain applicable. No alternate migration was cherry-picked. The five inherited unapplied migrations are recorded in `migration-sha256.txt`. No migration SQL changed in this continuation.

Safe changes: root dev-only transitive zod 4.6.5 → 4.6.7 fixes GHSA-mrhx-c7xc-m3w5 (oversized constrained collection memory exhaustion). Only its lock entry changes. Root full audit now blocks high severity instead of merely warning. Root and mobile Vercel configs disable automatic deployment for this branch before publication.

## Database evidence and limits

Fresh PostgreSQL 17 Docker container `hoop-build9-phase1`, `--network none`, no published ports, repository mounted read-only. Executed profile_private_fields, player_profile_privacy, opted_in_mfa, storekit_membership_isolated, ambassador_hq_isolated and stripe_trial_claims_isolated with ON_ERROR_STOP in separate disposable databases. All pass. Each transaction rolls back. Post-run public table counts are zero in all six databases. Logs are adjacent.

The private-field suite checks prepare-before-restrict raw reader compatibility, deployed defaulted legacy RPC signatures, masked username/legacy/paged searches, country consent, owner-only reads/edits, non-owner/anonymous/MFA/future-column denial. StoreKit suite verifies Stripe coexistence, refund isolation, ownership and disabled Apple configuration. Ambassador and trial suites exercise commission lifecycle and uniqueness. Node tests verify bootstrap, MFA, membership readers, checkout, StoreKit and ambassador handling; entitlement matrix passes 10 role/tier cells and 22 entitlements.

Negative controls use temporary local executable wrappers that forward createdb/psql/dropdb into this same networkless container (PGHOST=127.0.0.1 satisfies harness guard; no TCP or remote database involved). Raw-column, username, directory and consent regressions are detected.

**Blocked required gate:** production-schema-compatible catalog rehearsal could not be repeated. Protected snapshot/extras files named by docs/BUILD8-CATALOG-REHEARSAL.md are absent from this fresh workspace; no read-only database service is configured. Synthetic suites are not equivalent. Historical catalog PASS is not claimed as fresh evidence. Supply approved schema-only exports and reproduce that documented restore/rehearsal, checking signatures/defaults, ACLs, RLS, hooks, triggers and real subscription shape. Do not export production records. No production connection was attempted.

Legacy raw profile clients remain incompatible with the final private-column restriction; bridge preparation preserves their existing grants but does not eliminate historical direct-column exposure. Keep restriction blocked until installed-client compatibility/minimum version and explicit backend rollout approval. Preserve distinct username RPC and legacy argument defaults. Real hosted Auth/Storage/Realtime, physical-device and live-purchase acceptance remain outside synthetic checks.

## Dependencies

Fresh root full audit after targeted fix: zero high/critical, seven moderate development findings. Mobile full and production audits: zero findings. Root production audit is recorded separately. Dependabot API returns 403 because alerts are disabled, so no claim is made about unavailable GitHub alert state. Mobile inherits reviewed CommonJS decoder/image-size forks and scoped glob/minimatch upgrades from #745; audit clearance does not establish universal compatibility. Preserve SDK54/RN0.81.5/Metro0.83.3 and consumer/provenance tests. Node here is 24; remote CI uses 20/22.

## Rollback evidence and release constraints

SQL rollback observed: all six fixture schemas removed by transaction rollback; zero public tables afterward. This proves test transaction rollback only. Committed production rollback is NOT rehearsed and remains blocked with catalog rehearsal. Before any separately approved rollout capture prior definitions/ACLs/hooks and backup/PITR point, stop on auth failures/data leaks/entitlement drift, and prepare reverse-dependency compensating SQL preserving released RPCs. Never restore broad profile SELECT as an automatic privacy rollback; never overwrite Stripe subscription/commission records. Keep Apple disabled and do not blanket-push migrations.

Code rollback: revert this continuation commit to return zod lock entry, audit gate and branch deployment entries to parent state. This reintroduces the high finding; it is an emergency code rollback, not release clearance. Inherited RPC/privacy/dependency candidates can be abandoned without affecting main because this branch remains draft/unmerged. CI results must be read for the final PR head, not inherited successes. Remaining pending/failing checks are reported in the PR conversation/final handoff.

Fresh local checks: root/mobile TypeScript pass; 194/194 native tests pass; upstream fork provenance passes; lint passes with 125 existing warnings and zero errors. Full website build and final-head GitHub Actions are pending at initial publication. SQL rollback counts were independently queried after each suite. Dependency installation was retried using a fresh temporary npm cache after interrupted overlapping installs; final clean mobile install succeeded without lock changes. No audit suppression used.
