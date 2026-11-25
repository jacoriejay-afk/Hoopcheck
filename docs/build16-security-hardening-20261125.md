# Build 16 database and abuse hardening

## Applied and verified on 2026-11-25

- Isolated PR17 test project: migration `20261125041240_secure_test_feed_and_support_tables` enables RLS on the two minimal fixture tables and revokes direct public, anonymous and authenticated access. The fixture has no ownership columns or policies, so backend-only access is intentional. Do not copy its blanket revokes to production.
- Production: migration `20261125041345_build16_least_privilege_account_and_ticket_hardening` removes unnecessary privileges on roles, subscriptions and verification/claim requests, and restricts new support tickets to their initial open, unassigned and unresolved state.
- Fresh security advisors: both projects have zero ERROR-level findings. Function warnings and leaked-password protection remain unresolved; INFO-level RLS-without-policy tables are not automatically public.
- Effective privileges and support insert policy verified from PostgreSQL catalogs. Full application acceptance is still required.

## Pending migration and acceptance

`20261125042505_build16_support_submission_rate_limit` is now applied in production following isolated sequential, competing-request and daily-cap tests. It limits direct authenticated support submissions to 10 per 10 minutes and 40 per rolling 24 hours, serializes concurrent requests, and sets server timestamps. Trusted service-role workflows are excluded; their abuse controls must be checked at the server endpoint. The isolated fixture schema does not match production; use a full-schema local or existing compatible test environment, not a paid branch.

Acceptance:
1. Ordinary signed-in member can submit and read an own support ticket; another account cannot read it.
2. Forged requester, initial closed/assigned/resolved ticket and anonymous submission fail.
3. Same-account concurrent requests cannot exceed the rate limits, including client-supplied timestamps; another account remains independent.
4. Authorized moderator can update a ticket; normal users cannot update or delete it.
5. Verify membership, Stripe webhook, owner/admin role updates, player/team verification, HoopFeed and scam reports end-to-end.
6. Verify existing review/share rate limits, report/block workflows and public-inquiry CAPTCHA before activation.
7. Audit remaining SECURITY DEFINER functions individually, preserving legitimate RPC behavior. Configure and test signup/login CAPTCHA, admin MFA and leaked-password controls only when compatible with the existing plan and native/web clients.
8. Review auth and API logs for evidence of prior unauthorized use; no breach conclusion from advisor results alone.

No release submission, paid plan upgrade, public Reels activation or new paid staging branch is authorized by this change.

## Follow-up verification
- Removed TRUNCATE, TRIGGER and REFERENCES grants for anonymous/authenticated roles from all public tables in both environments. Before: production 20 tables with TRIGGER/REFERENCES; test two tables with all three. After: zero tables with any of these effective client grants in either environment.
- Hardened postgres-owned application-table defaults in both projects. Managed supabase_admin defaults remain unchanged and require provider-side review.
- Isolated rollback test of support throttle passed: 10 own submissions, client timestamp normalization, blocked 11th submission, rejected forged requester, denied cross-user visibility, independent second account. Verified fixture columns, grant and trigger did not persist. Competing-request and daily-cap tests subsequently passed on a synthetic isolated fixture; the production trigger has been applied and verified. Full application acceptance remains outstanding.
- Production owner MFA enrollment audit: one approved owner, zero verified MFA factors. Do not force MFA before verified enrollment and recovery.
- Production Vercel firewall configuration read denied; reconnect required. No firewall settings changed.
- Test edge logs search for feed/support REST paths in Nov 24 04:20Z–Nov 25 04:20Z matched zero among 509 events. This limited text search cannot establish whether earlier access occurred or whether any breach occurred.
- Latest Supabase advisors: zero critical errors in both projects; production 41 warnings, test 7 warnings. No paid resources or release submission.

## Latest hardening and verification
- Production support throttle applied as migration 20261125042505; 10 per 10 minutes and 40 per 24 hours for direct authenticated submissions. Isolated competing requests for the last slot resulted in exactly 10 rows; daily-cap test remained at 40. The temporary synthetic schema was dropped and verified absent. Production trigger exists and rejects a forged requester in a rollback test. Trusted service-role calls are excluded. A real signed-in support submission still requires application acceptance.
- Production review hardening applied as migration 20261125042713. Existing men's review trigger extended to share a five-per-24-hour rolling limit across men's and women's reviews for non-staff, with a per-author transaction lock, server-generated creation timestamps, email confirmation, and immutable client author/creation time. Existing RLS and API checks remain. Synthetic rollback tests passed for shared cap, timestamp normalization, timestamp mutation denial, identity spoofing denial, and unconfirmed email denial. All four production triggers verified enabled. End-to-end submission and concurrent cross-category review tests still required.
- Existing production RPC boundary SQL passed. Additional synthetic signed-in non-owner checks passed: no user listing, membership/role/verification elevation, directory deletion, or cross-user follow/review identity. No production data was modified by the tests.
- 32 RLS-without-policy findings examined across both projects: no direct anonymous or authenticated DML privileges. Production has zero anonymous-authentication users. Latest production advisors still report 0 critical errors and 41 warnings; no blanket revocation of legitimate RPCs. Vercel firewall reconnection, owner MFA enrollment, auth CAPTCHA, leaked-password configuration and application regression testing remain release blockers.

## Moderation and anti-flood follow-up
- Production migration 20261125042940 requires new profile reports to start open, new review comments to start pending, and assigns live-chat creation times on the server before applying the existing two-second slow mode. Isolated tests passed; production policies and enabled trigger verified.
- Production migration 20261125043300 applies per-account limits to direct authenticated profile reports (10/hour and 30/day) and review comments (20/10 minutes and 100/day), normalizes timestamps, and removes direct report UPDATE/DELETE grants. Isolated rollback tests passed for short-window caps, timestamp normalization, cross-account privacy, forged identity and independent accounts. Both production triggers verified enabled; daily-window and concurrency-specific tests for these new triggers and end-to-end application acceptance remain outstanding. Thresholds are conservative defaults pending usage review. Trusted service-role writes are excluded.
- Profile report API now has a staged 429 response for the specific throttle exception; not yet merged or deployed. Storage audit confirmed evidence and feed buckets are private; avatars and team logos are intentionally public. Some legacy buckets have no per-bucket MIME/size restrictions and need compatibility review. No changes made to storage metadata.
- Privileged RPC review confirmed several legitimate owner-only and moderator-only checks. Warnings remain pending comprehensive regression tests. Do not blindly remove grants or move functions simply to suppress advisor warnings. CAPTCHA and MFA enrollment remain blocked; leaked-password built-in protection requires a plan upgrade, which is not authorized.

## Live-game least privilege and MFA enrollment follow-up
- Production migration 20261125043619 converts current_user_has_live_game_membership() and fan_live_chat_room_open(uuid) to SECURITY INVOKER with an empty search path. A rollback comparison across all 19 production profiles (10 eligible) preserved membership outcomes; caller-visible room checks passed for sampled games. Both functions verified invoker after migration. Production advisor warnings decreased from 41 to 39; zero ERROR findings. Test environment has a different season-aware room predicate and zero eligible fixture profiles in the rollback comparison, so it was not changed on insufficient positive coverage.
- Web Account > Security & membership now has a staged /account/security page for opt-in TOTP enrollment, backup factor enrollment, and session challenge verification. Setup keys are displayed only in client component state, not logged or sent to a third party. No mandatory MFA policy yet; enrollment and recovery must be tested with the owner before enforcing AAL2 on administrative actions. No account was enrolled automatically. Mobile sign-in challenge and real-device acceptance remain pending.
- Production storage review found four buckets without specific MIME and size limits. Existing web file pickers/API accept the following, so configure through the Storage dashboard or Storage updateBucket API, without modifying managed storage tables via SQL:
  - profile-avatars: 10 MiB; image/jpeg, image/png, image/webp; preserve public status.
  - player-verification-documents: 10 MiB; application/pdf, image/jpeg, image/png, image/webp; preserve private status.
  - profile-claim-proofs: 10 MiB; application/pdf, image/jpeg, image/png, image/webp; preserve private status.
  - fan-group-images: 4 MiB; image/jpeg, image/png, image/webp; preserve private status.
  Check native upload compatibility, rejection of oversized/disallowed files, and private download authorization before final sign-off. MIME checks are not equivalent to malware scanning. Bucket configuration action is not available in the current Supabase connector; no storage setting changed.
- Vercel firewall reconnect, Auth CAPTCHA configuration, verified owner factor and recovery enrollment, full application/device acceptance, and review of remaining privileged RPCs are still open. No paid upgrades or submission.

## Follow eligibility least privilege
- Production migration 20261125044650 changes can_user_follow_target(uuid,text,uuid) to SECURITY INVOKER. Rollback comparisons covered all 19 production profiles and forged identities; all valid follow eligibility outcomes matched. Catalog verified invoker. Production warnings now 38, zero critical errors. Review eligibility invoker candidate not applied because the current comparison had no positive eligible-review cases.
- Vercel status checks for revision 91845c957b2dd8fffc69be9afae5909b7dce154a all succeeded; later revisions require fresh verification. Owner MFA still zero verified factors. No merge or release submission.

## Additional anti-flood acceptance
- Isolated daily-cap tests now pass for profile reports and review comments. Two simultaneous transactions competing for the last slot resulted in 10 reports and 20 comments respectively (not 11 or 21). Test schema removed and verified absent. No production records modified in this test. Application/device acceptance remains open.

## Firewall access restored
- Vercel production project firewall read and write access restored. Initial active config was default-only; active-attack status returned no anomalies for the queried last-day window. Added one custom log-only exploit-probe rule (rule_hoop_check_exploit_probe_monitoring_ib0AOE); verified active config version 1, firewall enabled, rule active/valid, action log. The API applied the log-only rule directly; no production blocking or challenge enabled. Review matching traffic before staging preview-only enforcement and obtaining owner approval for production enforcement. No plan changes or new paid features. No claim that attack traffic is absent historically.
