# Build 9 hosted follow-graph dependency review

Scope: isolated HoopCheck-PR17-Test only. No schema writes performed. This is a dependency assessment, **not** a migration approval.

## Verified hosted facts (read-only SQL, 2026-11-21)

- `public.follow_relationships` is absent.
- `public.get_own_profile()` is absent.
- `public.get_public_player_profile(uuid)` exists, owned by `hoopcheck_public_profile_reader`, with SECURITY DEFINER and empty search path.
- The SQL executor is `postgres`, which has no SET/USAGE ability on the protected function owner; the owner role is NOLOGIN, NOBYPASSRLS and lacks CREATE on public.
- `supabase_migrations.schema_migrations` exists. The queried history has no `20261006%` entry.

## Source dependency trace

1. `supabase/migrations/20261006102000_phase8_community_womens_profile_controls.sql` originally creates `public.follow_relationships`, its owner-only RLS policy and target index. **This file also creates unrelated review and women's-league objects and policies**. Replaying it wholesale without a complete catalog and data audit is unsafe.
2. `supabase/migrations/20261102150000_ig1_public_follow_lists.sql` defines public follow-list RPCs that read `follow_relationships`; it is downstream of the canonical follow table and requires review of its SECURITY DEFINER surface.
3. `supabase/migrations/20261113182500_hoopfeed_follower_only_read_rls.sql` references `follow_relationships` in follower-only feed access. This dependency is privacy-sensitive: do not replace it with permissive policy fallbacks.

## Required remediation sequence

1. Inventory installed schema objects, policies, functions and migration history against the **entire** canonical migration chain, including intervening follow migrations.
2. Prepare a reviewed, narrowly scoped reconciliation for the missing canonical follow-graph prerequisite; preserve original constraints, RLS and ownership, and explicitly verify downstream policy behavior. Do not invent a simplified follow table.
3. Obtain an existing, authorized function-owner-capable migration runner for the protected player profile RPC. Do not grant SET/CREATE or change owner to work around missing authority.
4. Rehearse each reviewed change in a rollback-only transaction against an isolated compatible baseline; verify repeatability, privilege boundaries, moderator visibility, country opt-in, blocked relationships and anonymous-auth restrictions.
5. Only after successful isolated application, run real authenticated owner, non-owner, enrolled AAL1 and AAL2 API requests and capture redacted assertions. Keep release HOLD until physical-device and legacy-client gates are complete.

## Evidence boundaries

The source inspection establishes dependencies but does **not** establish a safe minimal DDL patch, the correct installed state of all later follow contracts, or authorization to change hosted schema. CI passing does not substitute for authenticated hosted acceptance.
