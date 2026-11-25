# Build 16 database and abuse hardening

## Applied and verified on 2026-11-25

- Isolated PR17 test project: migration `20261125041240_secure_test_feed_and_support_tables` enables RLS on the two minimal fixture tables and revokes direct public, anonymous and authenticated access. The fixture has no ownership columns or policies, so backend-only access is intentional. Do not copy its blanket revokes to production.
- Production: migration `20261125041345_build16_least_privilege_account_and_ticket_hardening` removes unnecessary privileges on roles, subscriptions and verification/claim requests, and restricts new support tickets to their initial open, unassigned and unresolved state.
- Fresh security advisors: both projects have zero ERROR-level findings. Function warnings and leaked-password protection remain unresolved; INFO-level RLS-without-policy tables are not automatically public.
- Effective privileges and support insert policy verified from PostgreSQL catalogs. Full application acceptance is still required.

## Pending migration and acceptance

`20261125041400_build16_support_submission_rate_limit` is staged, not deployed. It limits direct authenticated support submissions to 10 per 10 minutes and 40 per rolling 24 hours, serializes concurrent requests, and sets server timestamps. Trusted service-role workflows are excluded; their abuse controls must be checked at the server endpoint. The isolated fixture schema does not match production; use a full-schema local or existing compatible test environment, not a paid branch.

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
