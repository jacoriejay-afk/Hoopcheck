# HoopCheck Build 9 — Release acceptance and external handoff (2026-11-21)

**Release decision: HOLD.** This is a current evidence inventory, not production sign-off. No production DDL/data writes, merge to `main`, Vercel deployment, EAS build, Apple credential changes, or billing modifications were authorized in this review.

## 1. GitHub reconciliation

- PRs #748–#754 are **merged into their respective development-stack base branches**, not evidence of a production release. Their checked PR-head workflows had successful results.
- Draft PR [#755](https://github.com/jacoriejay-afk/Hoopcheck/pull/755) remains open at `7f4427944b56c94ef21c54db070c259038ffde56`. Six exact-head workflows passed: Launch Test, entitlements, native security, Mobile App Checks, HoopCheck CI and unsigned iOS native verification.
- Draft PR [#757](https://github.com/jacoriejay-afk/Hoopcheck/pull/757) remains open on `fix/build9-hosted-preflight-20261121`, targeting PR #755's integration branch. It contains review-only follow-graph migrations, privacy audit documentation, and a self-contained SQL regression matrix. GitHub CI for the current PR head was **in progress** at the time of this report. Reconfirm CI on the actual final head before promoting.

## 2. Database evidence, isolated test project only

Checked project: **HoopCheck-PR17-Test**, reference `vcprqpjkyubzzcjatdpx` (not production).

- `public.follow_relationships`, `public.user_blocks` and `public.get_public_follow_list(text,text,uuid,uuid)` are absent in this isolated project's installed schema.
- `public.get_public_player_profile(uuid)` is installed, owned by `hoopcheck_public_profile_reader`, SECURITY DEFINER with restricted empty search path. The available `postgres` executor has `pg_has_role(...,'SET') = false` for that owner role. Do **not** transfer ownership, grant SET/CREATE/BYPASSRLS, or rewrite the function under another role to force a migration through.
- The **entire** `reports/build9/integration/follow-block-privacy-matrix.sql` was executed in a single rollback-only isolated transaction after synchronizing its actual-party block predicate with `supabase/candidates/build9_follow_list_block_filter.sql`. It returned no SQL error. It covers follow owner/non-owner/anon access; public/private follower/following discovery; both directions of blocks under canonical block RLS; unrelated viewers; unblock restoration; private player and fan visibility; and unsupported fan targets. This is *simulated database role/claim evidence*, not signed JWT HTTP acceptance.
- A separate read-only post-check confirmed the follow and block tables, public list function, and temporary profile-visibility changes were **not retained**. The candidates remain outside `supabase/migrations`; no persistent test-project mutation was performed.
- The Supabase **test-project** security advisor reported warnings for callable SECURITY DEFINER functions and disabled leaked-password protection, plus informational RLS-without-policy findings. These require per-item intent reviews; they are not evidence that public production is misconfigured. See the [advisor lint reference](https://supabase.com/docs/guides/database/database-linter).

## 3. Outstanding gates that cannot be truthfully signed off here

| Gate | Required evidence and authorized next action |
| --- | --- |
| Protected public profile migration | Owner-capable authorized migration executor, reviewed versioned reconciliation, isolated rehearsal, unchanged owner/ACL/search_path/privacy/moderation, and documented handoff |
| Canonical follow/block migration | Full migration dependency review, reviewed persistent candidate with rollback/rollback plan, test-project migration and real signed JWT HTTP owner/non-owner/anon privacy assertions |
| AAL1/AAL2 and installed Build 7 | Real authenticated API requests, MFA status verification and exact installed-client compatibility before restricting raw protected columns |
| Courtside 2.0 visuals | Actual approved before/after screenshots and interactive light/dark iPhone acceptance; visual fixture renders alone are insufficient |
| Apple Sandbox and physical iPhone | Startup freeze reproduction/regression, scrolling/touch, Google login, Face ID, StoreKit purchase/restore/renewal/cancel, sharing, signing and bundle-ID verification |
| Release action | Re-run final-head checks after any new commits; reviewed go/no-go; only then approve merge, production migration, EAS/TestFlight and deployment separately |

**No temporary database SQL rehearsal or PR-level CI result substitutes for these live gates.** Do not label Build 9 “complete,” “TestFlight ready,” or “production accepted” until all required evidence is attached.

## 4. Safe continuation

1. Review PR #757's final diff, including unrelated website settings/localization changes added on that branch; isolate or approve those separately rather than losing concurrent work.
2. Verify PR #757 final-head CI. Keep #755 and #757 in draft until the dependency chain and accepted release scope are reviewed.
3. Arrange approved owner-capable execution and real test-user JWT sessions in the isolated environment. Rehearse and document rollback before any persistent schema rollout.
4. Complete physical-iPhone, Apple Sandbox, exact Build 7 compatibility and Courtside visual acceptance, then make a separate production authorization decision.

Owner decision and external access remain the limiting factors. This report does not grant permission to bypass them.
