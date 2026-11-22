# Career Passport + HoopGroups production activation — 2026-11-22

## Applied database migrations (authoritative Supabase history)

Production: `HoopCheck`, ref `ucbdceaieyenljcwlhnj`. The following *additive*, versioned migrations were applied through Supabase and their exact versions are recorded in this branch:

| Version | Supabase migration name | Result |
|---|---|---|
| 20261122100133 | career_passport_owner_private_rls_20261122 | `public.player_career_stops`: RLS + 5 scoped read/write policies |
| 20261122100346 | hoopgroups_community_channels_v1_20261122 | 7 RLS-enabled group tables; 6 official seeded topic communities + 18 discussion topics |
| 20261122100402 | hoopgroups_community_owner_controls_v2_20261122 | Member-created group ownership, starter topics, owner-limited edits and service-only moderation |

Source-of-truth files live in `supabase/migrations/` with matching version prefixes, to prevent migration history drift.

## Confirmed test evidence

- Career Passport staging rollback-only tests used ephemeral test identities: Premium Player could insert, read, publish, and delete. Other signed-in users could not read private entries or update a public entry; anonymous users could only read public opt-in entries. Fan insert denied. No test users or rows were retained.
- HoopGroups staging rollback-only tests: group creator auto-joined, all three starter topics created, other members could not read pending posts, service-role moderation could approve, approved members could read, blocked authors were hidden, and nonmembers could not read even approved posts.
- Cross-group service-role RPC test: an unrelated actor was rejected as an unauthorized moderator and post remained pending.
- A production rollback-only v1+v2 migration rehearsal succeeded before application; no tables were left behind. Production now has 6 seed groups, 18 topics, 7 RLS-enabled tables, no member posts, and no member rows. The moderation RPC is executable by `service_role` only, not `anon` or `authenticated`.
- No production user data backfill, existing reviews mutation, migration of official Team Fan Groups or paid entitlement change was performed.

## Release sequence and ownership

1. Obtain green exact-head GitHub CI, launch, entitlement checks and Vercel preview on the release branch. Verify the migration files match applied versions and the Community admin route is restricted by bearer authorization and owned-channel check.
2. Merge this website release to `main` (do not merge Build 9 protected backend branches as part of this release). Confirm Vercel production READY and correct commit on `hoopcheck.online`.
3. On Vercel project `hoopcheck` only, enable `NEXT_PUBLIC_HOOPGROUPS_CHANNELS_ENABLED=true` and `HOOPGROUPS_CHANNELS_SERVER_ENABLED=true` for **production**. Rebuild / redeploy `main`, because the public flag is compiled into the client bundle.
4. Confirm the new production deployment READY on `hoopcheck.online`. Verify protected moderation GET without a bearer returns 401 (not an open queue). Check runtime errors and Supabase logs.
5. Run real signed-in iPhone/Safari acceptance: owner create/edit/join/leave, topic settings, pending posting and approval, second-member visibility, report, block, and unauthorized actor denial. Test English, Spanish, light/dark, keyboard, safe-area nav and text zoom. Test Career Passport owner save/private/public and non-owner privacy. **These real-account checks require user sessions; database role simulations are not substitutes.**

## Rollback

For HoopGroups, disable **both** Vercel flags in production and redeploy the last healthy main revision. Do **not** drop the tables or approved user posts as a rollback. Team Fan Groups remain separate and unchanged. If Career Passport user writes are found unsafe, disable writing in the client and preserve career entries while reviewing the additive table security. Do not weaken RLS to clear an error.

No Apple EAS/native change is part of this deployment. Existing Build 9 privacy and installed-client compatibility gates remain independent.
