# SECURITY-FINAL — read-only production audit and proposed remediation

Date: 2026-11-12. No production mutation or migration is authorized by this document.

## Verified production facts
- RLS enabled on feed_posts, feed_poll_votes, feed_post_bookmarks, feed_post_checks, feed_post_comments, feed_post_archives and feed_posting_activity.
- Production migration history includes secure_feed_poll_votes, secure_feed_bookmarks, revoke_client_truncate_privileges_21_tables, create_private_hoopfeed_buckets, unify_hoopfeed_read_and_checks_rls and hoopfeed_threaded_comments.
- feed_post_comments.parent_id exists.
- Legacy feed-images and feed-videos buckets are public; feed-images contains 7 objects. hoopfeed-private-images and hoopfeed-private-videos exist and are private.
- Existing feed_poll_votes SELECT/INSERT/UPDATE policies check approved status and poll options, but do not explicitly check expires_at or can_view_player_feed_post.
- Bookmark INSERT checks approved status, not explicit expiry/viewer access; checks/comments read policies check approved status.
- admin_set_user_role verifies actual admin role and protects last admin.
- admin_set_membership accepts is_current_user_admin_or_moderator and may grant non-Stripe Pro/Premium membership.

## Proposed changes (NOT APPLIED)
1. Inventory every permissive policy and every application write path before changing RLS. Avoid adding another permissive policy as a false restriction.
2. Prepare replacement poll vote, bookmark, check and comment policies that enforce eligible viewer access, status and expiry, while preserving approved permanent posts (expires_at IS NULL). Explicitly test author/moderator behavior and block semantics. Confirm the desired public-vs-followers feed policy first; do not blindly reuse a followers-only helper for unified discovery.
3. Confirm whether moderators should have membership-grant powers. If not, prepare an admin-only guard and revoke unnecessary EXECUTE grants after checking all callers.
4. Inventory the seven public legacy images and their feed references without revealing private object names. Design a copy-verify-switch-revoke rollback-safe migration. Never turn the existing public bucket private before verifying all dependent uses.
5. Test as anonymous, free, Pro, Premium, author, eligible follower, blocked user, moderator and admin via authenticated REST with separate test accounts. Cover expired posts, permanent posts, polls, comments and media.
6. Reconcile PR #477, #473, #469, #459 and merged #493 against current main. Only close obsolete PRs after code comparison.

## Release gate
No merge, deployment, production DDL, bucket change, or paid infrastructure. Require isolated/free testing, exact-head CI, migration review and explicit release approval.
