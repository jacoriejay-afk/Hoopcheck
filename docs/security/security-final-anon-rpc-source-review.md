# SECURITY-FINAL — anonymous SECURITY DEFINER RPC source review

Read-only `pg_get_functiondef` inspection of production, 2026-11-12.

| Function | Intended result | Observed checks | Follow-up |
| --- | --- | --- | --- |
| `get_public_follow_list` | Follower/following public display | Follower profile must be public for follower mode; following mode checks owner or public follower, and public targets or owner | Check blocked users, profile visibility changes, and whether target-team follow disclosure is intentional |
| `get_public_following_count` | Following count | Counts public targets and team targets; owner sees all | Check count privacy and expected UI semantics |
| `is_team_profile_claimed` | Boolean team claim badge | Approved claim + matching team existence, otherwise false | Verify claim status is intended to be public |
| `is_username_available` | Signup username availability | Format 3–20 ASCII alphanumeric/underscore and case-insensitive uniqueness; excludes caller's own ID | Check account enumeration/rate limiting, but anonymous access may be necessary at signup |

All four are SECURITY DEFINER and callable by anonymous users per security advisor. The observed SQL does not directly return private profile fields outside the specified projections, but visibility/blocking behavior has not been authenticated-tested. Do **not** revoke anonymous EXECUTE wholesale: it may break public browse and signup.

## Follow-up gates
1. Verify follow relationship block-list semantics and public profile visibility using representative test accounts.
2. Confirm any intended anonymity of private users' follow counts and memberships.
3. Validate signup rate limiting for username availability.
4. If fixes are needed, prepare narrow changes with regression tests rather than generic RPC revocations.

No production changes.
