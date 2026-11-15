# GROUPS-1 Parts A–B audit and migration gate

## Existing FAN-GRP-1 schema (verified)
- `team_fan_groups.team_id` is the **primary key** and foreign-key target for members, posts, moderators, requests and reports.
- Existing auto-creation trigger creates **one group per team row**, not one per canonical club.
- Existing member authorization and summary function explicitly restrict members to `profiles.account_type='fan'`.
- Existing route `/api/fan-groups` enforces `canUseFanGroups`; new all-role permissions are **not** active.
- Existing posts, comments, storage objects and report records reference team IDs or posts that must survive consolidation.

## Why deduplication is not yet safe to run
No verified canonical club identifier has been established for multiple `teams` rows across competitions. Matching names is unsafe: same-named clubs may be unrelated. Repointing memberships alone would lose access to posts, images, comments, reports, moderator grants and old routes.

## Required Part B before any migration/deploy
1. Read-only production inventory: candidate duplicate teams grouped by a *verified* canonical club mapping, including country, sport, gender, league, approved claims and existing group IDs. Require human review for ambiguous candidates.
2. Add a stable group UUID/canonical club ID while keeping team IDs as backward-compatible route aliases; map every team to its canonical group and every league listing to that group.
3. Build a **transactional, idempotent** merge preserving earliest group and all member join dates, posts, comments, images, moderators, reports, requests, pins and audit records; handle unique conflicts explicitly without silently dropping data.
4. Rework RLS and summary functions for all recognized roles via `getHoopCheckEntitlements` at API boundaries, preserving strict private visibility. Verify claim-scoped club moderator rights.
5. Snapshot pre/post row counts, FK integrity and representative two-league club proofs, with restore procedure.
6. Keep Part C group creation and all community writes disabled until in-group Report/Block and admin queue tests pass.

## Part A current limitations
The first UI commit uses existing team-scoped group records, real per-group summary RPC counts, and authenticated member rows. Category entries other than Club Groups remain disabled. Country/league filters apply to the current loaded page, not the entire directory. No Active Today section is shown without an authoritative activity query. The existing group detail route remains fan-gated. This is an **incomplete draft**, not a release candidate.

## Verification required
Run TypeScript, lint, relevant group scripts, migration rehearsal on a disposable database, authenticated role/RLS tests, two-theme mobile/desktop checks, and compare HoopFeed Free entitlements before/after. No production changes until these pass.
