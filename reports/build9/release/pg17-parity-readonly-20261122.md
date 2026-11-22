# Build 9 PostgreSQL 17 schema parity — reproducible read-only gate
Date: 2026-11-22. Development-only evidence. **Release decision: HOLD.**

## Executed SQL

`supabase/tests/build9_pg17_schema_parity_readonly.sql` was fetched back from this Git branch (exact file blob `60f1270595fd1ce11fb8d1658d2ed63f853ee092`) and executed **read-only** against both the existing production and isolated PR17-Test databases. The query returns only catalog metadata, schema digests, grants and function properties; no user rows, access tokens or credentials. No DDL, GRANT, REVOKE, migration, Auth change or stored data write was made.

| Comparison | Production HoopCheck | Isolated HoopCheck-PR17-Test |
| --- | --- | --- |
| PostgreSQL | 17.11 | 17.11 |
| Recorded migrations | 203 | 48 |
| Public RLS policies | 211 | 66 |
| Of four targeted tables present | 4/4 | 3/4; `fan_live_chat_messages` missing |
| Target-table column digest | `f25c287263f77988745565f155f8c0cc` | `47892a4e28e3f8e8af7042baf17cb83d` |
| All public policies digest | `bc47455991d798df14002df0f2142f6b` | `19bffeadad7e16a0ca9090cb75e53b37` |
| `get_public_player_profile(uuid)` | SECURITY INVOKER, owner `postgres`, search_path `public` | SECURITY DEFINER, owner `hoopcheck_public_profile_reader`, empty search_path |
| `get_own_profile()` | Missing | Missing |
| Anonymous raw `profiles.current_country` SELECT grant | Yes | No |
| Authenticated raw `profiles.current_country` SELECT grant | Yes | Yes |
| Authenticated raw `profiles.moderation_note` SELECT grant | Yes | Yes |

**Conclusion:** The isolated database is **not production-schema equivalent**. An isolated rehearsal there cannot sign off the final private-column revocation, `get_own_profile()`, protected-function ownership reconciliation or installed Build 7/8 behavior. A SELECT grant finding does not, by itself, prove cross-user row access after RLS.

## Security advisor triage (production, read-only)

The current advisor reports four anonymously executable SECURITY DEFINER functions: `get_public_follow_list`, `get_public_following_count`, `is_team_profile_claimed`, and `is_username_available`. Inspection of their definitions shows public-facing follow, team-claim and username checks with visibility checks for the follow functions. This is **not** an authorization guarantee: actual anonymous/nonowner and block/privacy regression tests are still required. The overall advisor tally is 16 INFO tables with RLS but no policy, 4 WARN anonymous-callable SECURITY DEFINER, 36 WARN authenticated-callable SECURITY DEFINER (including the four), and 1 WARN leaked-password protection disabled. Do not mass-revoke PUBLIC/EXECUTE, re-own functions, switch SECURITY DEFINER/INVOKER or change production Auth settings based only on a lint warning; these may be intentionally accessible and need a documented compatibility review.

## Required follow-up — no production mutations authorized

1. Obtain an authorized **schema-only** production PostgreSQL 17.11 snapshot using an existing approved read path; restore it to a disposable, cost-approved test target. Never copy user data or privileged secrets into fixtures.
2. Re-run the checked-in SQL against the restorable copy. Investigate every catalog mismatch; a hash match is necessary but not sufficient for schema equivalence. Confirm migration ordering, function ownership, privileges, RLS, indexes, triggers and rollback.
3. Rehearse the exact versioned privacy migrations on that copy under the appropriate **existing** function-owner identity. Do not grant elevated ownership or bypass RLS merely to make a rehearsal pass.
4. Obtain signed actual anonymous, Free, Pro, Premium, owner/nonowner/admin AAL1/AAL2 HTTP results, including allowed/denied reads and writes, moderation, country visibility, client reset/cancellation, and installed Build 7/8 direct `profiles` read compatibility. Simulated SQL role claims are not equivalent to real JWT and PostgREST behavior.
5. Complete physical-iPhone startup, scrolling, Face ID, OAuth, Passport PDF/share/cleanup, then Apple Sandbox trial/purchase/restore/cancel/refund. Release review requires explicit owner approval after all evidence is attached.

The two-hour postgame chat SQL under `supabase/candidates/live_game_chat_realtime_directory_review_only.sql` remains **REVIEW ONLY**, and `NEXT_PUBLIC_LIVE_POSTGAME_CHAT_ENABLED` must stay OFF. The already merged international-team seed must not be applied again. Do not merge Build 9 release PR #755 to main or initiate EAS/TestFlight from this work.

This parity query **exposes a real release blocker**; it does not remove it and must not be labeled a production privacy fix.
