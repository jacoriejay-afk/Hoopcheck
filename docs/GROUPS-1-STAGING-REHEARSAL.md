# GROUPS-1 staging rehearsal prerequisite (2026-11-15)

## Verified environment
- Production Supabase project `ucbdceaieyenljcwlhnj`: FAN-GRP-1 tables exist; no GROUPS-1 staging migration applied.
- Connected `HoopCheck-PR17-Test` project `vcprqpjkyubzzcjatdpx`: `public.teams`, `public.team_fan_groups`, and `public.hoopgroup_club_identity_review` are all absent as verified by read-only `to_regclass`.
- Therefore **do not** apply the GROUPS-1 migration to this test project in isolation; it depends on the full baseline schema. Do not apply to production merely to bypass this blocker.

## Safe rehearsal plan
1. Establish a complete, version-matched isolated schema (including teams, profiles, FAN-GRP-1 tables, RLS, triggers, and storage policies), with no copied credentials or production PII.
2. Create synthetic clubs: one in domestic and continental leagues; a separate women's club with the same display name; and a similar-name unrelated club.
3. Populate overlapping member and moderator assignments, two published pinned posts, join requests, comments, reports, and private image paths.
4. Apply additive identity staging migration. Confirm all legacy rows default to official club and all new tables have RLS and no client privileges.
5. Create explicit human-reviewed canonical mappings only for true same-club records.
6. Run `scripts/sql/groups-1-merge-readiness.sql`, `groups-1-collision-audit.sql`, and `groups-1-identity-assertions.sql`. All must pass or fail closed as expected.
7. Implement and rehearse transactional merge preserving all records and old ID redirects, including signed-image access, before enabling it. Verify old URLs and existing API behavior.
8. Run app TypeScript, lint, build, browser/mobile tests, all role gates and security tests; obtain successful CI checks.
9. Only then consider non-destructive production migration and approved rollout.

## Known correctness blockers
- The old schema uses team UUID as primary group key and as child foreign keys.
- Group storage authorization extracts team UUID from the first storage folder; redirecting group ID alone is insufficient.
- A partial unique index permits only one published pinned post per group.
- A partial unique index permits only one platform moderator per group.
- Membership primary key and pending request partial unique index can collide on merge.
- Reports carry both team_id and post_id, which must remain consistent.
- Group post RLS and the existing summary RPC currently restrict membership checks to fan accounts.
- Country/league filtering on the current directory is only per loaded page, not a global database filter.

**Release decision: BLOCKED.** No destructive migration, merge or production deployment is authorized by this audit alone.
