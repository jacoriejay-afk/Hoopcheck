# HoopGroups staging activation and production gates — 2026-11-22

## Current state (verified)
- The HoopGroups UI is present at `/hoopgroups`; the signed-in community experience is disabled unless `NEXT_PUBLIC_HOOPGROUPS_CHANNELS_ENABLED=true`.
- The privileged moderation API at `/api/admin/hoopgroups` stays disabled unless **separately** enabled by `HOOPGROUPS_CHANNELS_SERVER_ENABLED=true`. It still requires authorized moderator authentication.
- Production Supabase `HoopCheck` has **no** `public.hoop_group_%` tables as of this review. **Do not enable either production feature flag or publish the community as live.**
- A separate test Supabase project `HoopCheck-PR17-Test` (ref `vcprqpjkyubzzcjatdpx`) now contains the existing additive candidate schema from `supabase/candidates/hoopgroups_channels_v1_review_only.sql`: seven RLS-enabled tables, six seeded communities and eighteen channels. There were zero memberships and zero posts after the rollback-backed role smoke test.
- No existing Team Fan Groups tables were changed. Fan groups and topic-based HoopGroups are distinct surfaces.

## Test database checks performed
- The candidate ran successfully inside `BEGIN ... ROLLBACK` before the unchanged SQL was applied **only** to the test project.
- Verified every new table has RLS enabled; `anon` has no SELECT grant; `authenticated` has no direct UPDATE grant on posts; `hoop_group_moderation_events` grants no client access.
- Role-simulated SQL transaction tested member join, own pending message visibility, non-member isolation, write-denial, and unprivileged moderation denial. Rolled back; staging kept zero test memberships and messages.
- Test advisors flagged missing indexes on four new foreign keys; covering indexes were then added to the reviewed candidate and test-only schema and independently verified present. Existing unrelated advisor notices were not modified. No production DDL was executed.

## Release requirements
1. The new member-user, block-user, report-reporter and moderation-actor indexes are present in staging and in the review candidate. Rehearse the final candidate against a schema-equivalent production snapshot without weakening RLS.
2. Validate browser HTTP requests with two real staging accounts: join, leave, channel switch, message submission as pending, approved visibility, report, block, and rejected unauthorized writes. Test role switching, mobile overflow, Safari PWA and both themes.
3. Verify an authorized moderator can read and act on pending posts via `moderate_hoop_group_post`, and cannot bypass eligibility, audit, or lifecycle checks. Test moderation state transitions and abuse throttling.
4. Produce a properly versioned, reviewed production migration and a rollback procedure that preserves any approved community data. Never copy test users or stage posts to production.
5. Only after approved backend rollout and real auth/moderation acceptance, set `NEXT_PUBLIC_HOOPGROUPS_CHANNELS_ENABLED=true` and `HOOPGROUPS_CHANNELS_SERVER_ENABLED=true` for the correct verified deployment environment, rebuild, and retest.
6. Obtain exact-head CI and physical iPhone acceptance before merging or publishing a production claim.

## Rollback
Disable **both** HoopGroups feature flags and redeploy the last healthy website. Preserve the new tables and moderation records pending a reviewed data-retention decision; never drop live community content as an emergency toggle. Team Fan Groups remain separate and unaffected.
