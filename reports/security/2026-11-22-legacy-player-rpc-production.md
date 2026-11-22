# Legacy player RPC privacy hotfix — production verification (2026-11-22)

**Applied successfully to Supabase project `ucbdceaieyenljcwlhnj`** via the guarded transactional migration runner. Production migration record: `20261122032844 / legacy_player_privacy_mask_phase1_20261122` (199th migration at verification). This migration file is a verbatim archival copy of the reviewed candidate `supabase/candidates/build9_legacy_player_privacy_phase1.sql`, which was merged by PR #789 at `fe857a1954f78e2175b00f1952aeb0aa23092427`.

## Verified installed function contracts
| RPC | Source MD5 after apply | Mode |
| --- | --- | --- |
| `get_public_player_profile(uuid)` | `d9cd27d5b6e426397674d48184530b24` | SECURITY INVOKER |
| `search_public_players(text,text,text,boolean,integer)` | `c2eee54d975b81dfeea139cacc2b8bee` | SECURITY INVOKER |
| `search_public_players_page(text,text,text,boolean,integer,integer)` | `9645a81f5e34e52e95946744ba05c9d1` | SECURITY INVOKER |

All remain owned by `postgres`, STABLE, `search_path=public`, EXECUTE available to existing anonymous/authenticated roles; original output signature/defaults preserved. CI PostgreSQL 16 synthetic fixture (exact bodies) and pre-release isolated PostgreSQL 17.11 transaction rehearsal passed. Production anonymous-role read-only test invoked both legacy directory RPCs successfully, returned 2 rows in each sample, and found 0 non-consented country values in those samples. No record data, roles, table SELECT grants, RLS policies, Stripe configurations or entitlements changed in this phase-1 migration.

## Open security gate — DO NOT MARK FULL PRIVACY COMPLETE
**Raw `public.profiles.current_country` table SELECT remains granted to `anon` and `authenticated`; `get_own_profile()` owner RPC remains absent.** The small masked-function hotfix improves legacy RPC results and search but does not secure direct REST/table reads. The broader private-column restriction and Build 9 backend #755 are HOLD until a sanitized production-schema-equivalent rehearsal, real signed AAL1/AAL2 owner/non-owner requests, and installed Build 7/8 compatibility (including physical device tests). Do not force protected function ownership, weaken RLS, or grant elevated roles. Separate rollout and rollback review required.

A distinct production migration `20261122031728 / phase5_reel_moderation_20261122235000` was recorded immediately before this hotfix; the RPC preflight checked exact installed source identity after that other migration. Any later drift must stop further rollout.
