# DEL-1 live database foreign-key and deployment audit

Checked read-only against Supabase project `ucbdceaieyenljcwlhnj` on 2026-11-06.

## Production schema observations

The following proposed tables are absent from the live database at audit time:
- `public.account_deletion_requests`
- `public.user_blocks`
- `public.content_reports`
- `public.public_career_page_settings`

Therefore the new deletion-request migration on the feature branch has **not** been applied to production. No schema or user data was changed during this audit.

The live `profiles` table has many inbound foreign keys. A read-only catalog query found these profile references (grouped by behavior):

### CASCADE references
`coach_team_requests.user_id`, `directory_team_requests.requester_id`, `display_name_changes.user_id`, `fan_connection_requests.fan_id/requester_id`, `fan_feed_archives.user_id`, `fan_feed_checks.user_id`, `fan_feed_comments.author_id`, `fan_feed_likes.user_id`, `fan_feed_posts.author_id`, `fan_live_chat_presence.user_id`, `fan_live_chat_reports.reported_user_id/reporter_id`, `fan_live_chat_user_controls.target_user_id/user_id`, `fan_live_game_reminders.user_id`, `feed_post_archives.user_id`, `feed_post_checks.user_id`, `feed_post_comments.author_id`, `feed_posts.author_id`, `follow_relationships.follower_id`, `identity_verification_sessions.user_id`, `player_contact_messages.sender_id`, `player_contact_requests.player_id/requester_id`, `profile_claim_requests.requester_id`, `profile_reports.profile_id/reporter_id`, `review_comments.author_id`, `review_likes.user_id`, `review_reports.reporter_id`, `reviews.author_id`, `subscriptions.user_id`, `team_fan_group_comments.author_id`, `team_fan_group_join_requests.user_id`, `team_fan_group_members.user_id`, `team_fan_group_moderators.user_id`, `team_fan_group_posts.author_id`, `team_fan_group_reports.reporter_id`, `team_fanfeed_posts.author_id`, and `womens_team_reviews.author_id`.

### SET NULL references
`profile_claim_requests.reviewed_by`, `sponsor_inquiries.user_id`, `support_requests.user_id`, and `team_fan_group_join_requests.reviewed_by`.

## Consequences for DEL-1

- Both `reviews.author_id` and `womens_team_reviews.author_id` currently cascade on profile deletion. Reviews must be anonymized and detached from the profile in a deliberate schema change before deleting a profile; simply deleting the Auth user would otherwise destroy review records.
- `subscriptions.user_id` currently cascades. If the local subscription record is deleted, the app can lose the association needed to show membership status and subscription management instructions. Preserve the required billing/audit record without cancelling Stripe or store subscriptions; this needs an explicit retention design and migration.
- Report rows and moderation history may also cascade with the reporter or subject profile. Retention and anonymization rules must be chosen before the finalizer runs.
- A deletion finalizer cannot safely be implemented as a generic `deleteUser` call until every inbound reference and retention requirement has a tested disposition.
- Existing cascade behavior means that a successful Auth deletion is not proof that required reviews, billing records or moderation records were preserved.

## Release status

This was a read-only catalog inspection. No production migrations, data mutations, auth deletions, subscription cancellations, merges or deployments were performed.


## Follow-up safety hardening on the feature branch (2026-11-06)

The legacy `POST /api/account/delete` handler has now been replaced on this branch with a fail-closed `409 ACCOUNT_DELETION_LIFECYCLE_NOT_READY` response. It no longer cancels Stripe subscriptions, removes storage, or deletes Auth users. This is an interim safety guard, not the completed DEL-1 lifecycle. The profile UI's existing delete action will receive the explanatory response and leave the account intact.

This guard must remain until the complete 30-day lifecycle and its tests replace it. It has not been deployed to production.
