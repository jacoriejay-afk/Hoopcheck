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
