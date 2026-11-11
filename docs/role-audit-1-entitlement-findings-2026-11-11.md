# ROLE-AUDIT-1 — Unified HoopFeed role and moderation audit

Decision confirmed 2026-11-11: **One unified HoopFeed** for Player, Fan, Coach, Scout, Agent, and Club Admin accounts. Admin override is preserved. Do not restore a separate Fan Feed UI.

## Changes
- The canonical entitlement helper recognizes only supported account types for paid HoopFeed access, rather than treating arbitrary nonempty role strings as authorized.
- Player, Fan, Coach, Scout, Agent, and Club Admin Pro/Premium retain read/post permissions; Free cannot post. Admin override remains.
- Tests assert all six supported roles, unknown-role denial, and existing Fan Pro posting contract.
- `/fan-feed` remains a redirect to `/feed`; the legacy `/api/fan-feed/moderate` remains in place for compatibility pending caller inventory. It is Fan-only and must not become a second public composer.

## Legacy Fan Feed compatibility finding
- `app/api/fan-feed/moderate/route.ts` still writes `fan_feed_posts` and `fan_feed_comments`, while the unified `/feed` page uses `feed_posts` and `/api/hoopfeed/moderate`. This is a real divergent write path, not evidence of a second active UI.
- Do not delete legacy rows or remove the endpoint until callers, saved deep links, and any migration/archival requirements are inventoried. Test that no active UI invokes the legacy route.

## Source findings and release blockers
- `app/feed/page.tsx` posts through `/api/hoopfeed/moderate` and has one composer.
- `app/api/hoopfeed/moderate/route.ts` checks the canonical entitlement server-side, and restricts pinning and official news to Admin.
- On current main, vote, bookmark, share, and other actions use service-role reads. **PR #464** contains visibility fixes and must be integrated before claiming cross-account privacy. **PR #467/#473** address 24-hour expiry. Do not infer privacy solely from UI checks.
- Legacy `/api/fan-feed/moderate` uses a separate Fan-only authorization path; audit callers and sunset it in a follow-up after compatibility verification.
- Static source review does not establish successful staging login, posting, moderation, or RLS isolation.

## Review submission authorization (source verified)
- `app/api/reviews/route.ts` requires an authenticated, email-confirmed user, reads membership and profile through the user-scoped Supabase client, and calls `canWriteReviews`.
- `canWriteReviews` requires **Player + verified + active Pro/Premium**; Fan, Coach, Agent, Scout, and Club Admin roles cannot submit reviews through this endpoint.
- Team reviews additionally require `can_user_review_team` RPC eligibility; review submission uses `claim_review_submission_slot` and enters pending status.
- This is source-level authorization evidence only; direct database write policies, coach/league eligibility, and actual staging submissions still need testing.

## Team Manager moderation authorization — confirmed defect and fix
- **Defect:** `app/api/fan-groups/route.ts` previously used `entitlements.canModerateFanGroups` as an unconditional `isModerator` grant, so every `club_admin` could moderate every team's Fan HQ group through the service-role endpoint.
- **Fix in PR #478:** club admins now require an explicit moderator row for the requested `team_id`. Platform moderation continues through the platform role check. Existing Fan co-moderator assignments still count.
- **Must verify in staging:** Club Admin A cannot pin, remove posts, appoint moderators, or kick members in Team B's group; Club Admin A can moderate Team A only with an assignment; platform Admin/moderator permissions still work.
- Review the account-type-level `canModerateFanGroups` entitlement used by `components/TeamFanGroupEntry.tsx`: the UI may still display moderation controls for unassigned club admins, although the API now denies unauthorized actions. Align UI with team-scoped authorization in a follow-up.

## Platform role lookup correction
- Fan HQ API previously called `is_current_user_admin_or_moderator` on a service-role client, which does not carry the request user's JWT context. This could incorrectly deny platform moderation.
- The API now reads `admin_roles` for the verified `user.id`, checks normalized `admin` / `moderator` roles, and fails closed on lookup errors.
- Platform Admin is allowed to moderate; platform Moderator requires the group's platform moderator designation; Club Admin and fan co-moderator require explicit team-scoped appointment.
- UI uses an authenticated client RPC and may not exactly match platform Admin's unconditional API access. Verify UI/server parity in staging.

## Agent/Scout source audit
- `app/agents-hq/page.tsx` checks the signed-in profile `account_type` and permits only `agent` or `scout` into the workspace UI.
- `components/PlayerContactButton.tsx` uses `canUseAskPlayer`, which requires active Pro/Premium for Players, Scouts, and Agents. This is a client-side control and does **not** prove the receiving API enforces the same rules.
- `canUseRecruitingNetwork` currently permits Premium Players, not Agents/Scouts; verify whether this flag is intentionally for player-side recruiting only before modifying it.
- Audit the contact/request API and database RLS for direct-call bypasses. Authenticated role-by-role tests are outstanding.

## Agent/Scout direct database contact security
- `components/PlayerContactButton.tsx` writes directly to `player_contact_requests` and `player_contact_messages`; server-side access relies on database RLS, not an API route.
- `20261007210000_fan_connections_player_requests.sql` creates a Pro/Premium Player/Scout/Agent INSERT policy. `20261009124500_consolidate_player_contact_insert_policies.sql` adds an `eligible subscribers can request players` policy, requiring Premium for Scout/Agent within that particular policy.
- PostgreSQL permissive policies combine with OR; the older Pro/Premium policy is not dropped by the later migration. This makes the effective policy potentially broader than the newest policy's text suggests. Verify all live `pg_policies` and consolidate in a dedicated migration after confirming desired Pro/Premium rule.
- `20261008105244_enable_player_hoopchat_realtime.sql` limits message SELECT/INSERT to participants of accepted requests. It does not itself recheck current paid membership after acceptance; determine desired ongoing messaging access before modifying.
- Source audit only; live database policy state and authenticated direct-write tests remain unverified.

## Live Supabase policy verification (read-only, 2026-11-11)
- Queried `pg_policies` for `public.player_contact_requests` and `public.player_contact_messages` on project `ucbdceaieyenljcwlhnj`; **no data or schema was modified**.
- **Correction to migration-only hypothesis above:** live `player_contact_requests` has only one INSERT policy, `eligible subscribers can request players`. There is **no overlapping older Pro/Premium policy live**.
- **Confirmed functional mismatch:** live INSERT policy requires `premium` for Scouts/Agents, whereas `lib/membership-tier.ts` `canUseAskPlayer` permits `pro` or `premium` for Scouts/Agents. Pro Agents/Scouts see the contact action but will receive RLS rejection.
- Live INSERT policy allows Player Pro/Premium and checks requester account type and public, non-suspended Player target.
- Live message SELECT/INSERT policies require accepted requests and participating users. Live request UPDATE is restricted to the recipient Player with accepted/rejected status.
- **Recommended follow-up (not applied):** decide whether Agents/Scouts should require Premium or Pro/Premium, then align client entitlement and database policy through a reviewed migration. Current agreed product rule in this audit is Pro/Premium, so favor a migration only after approval.
- No authenticated role-by-role direct-write tests have been performed.

## Live profile/admin privilege boundary (read-only)
- Live `profiles_own_update` RLS permits updating one's own profile row by ID; **RLS alone does not protect account_type**.
- Live `prevent_user_privileged_profile_fields` BEFORE UPDATE trigger explicitly rejects account_type changes for non-admin/non-moderator users, except service-role operations. Thus the obvious self-promotion route is blocked by this trigger, rather than by RLS.
- Live `admin_roles` has only `admin_roles_own_read` SELECT policy for authenticated users; no INSERT/UPDATE/DELETE user policy was returned.
- Audit result is source/schema inspection, not a successful authenticated exploit attempt. Preserve the trigger and test it with a non-admin session before release.

## Unknown-role pay-history hardening
- `getHoopCheckEntitlements` previously set `canViewTeamPayHistory` for any nonempty role other than `fan`, including unrecognized role strings.
- Changed to `recognizedRole && !isFan`, preserving supported account types while denying unknown roles; added regression assertion in `scripts/test-membership-tier.mjs`.
- The `team-pay-checkins` API already checks `entitlements.canViewTeamPayHistory`. Fresh CI and authenticated checks are required.

## Draft-branch corrections and release caveats
- Added a **review-only** SQL migration `20261111180000_align_agent_scout_contact_pro_premium.sql` to align Scout/Agent contact INSERT RLS with Pro/Premium UI entitlements. The migration is **not applied** to the live database; current production policy still requires Premium for Scout/Agent.
- Unified HoopFeed moderation endpoint now rejects expired source posts for reshares, comments, poll votes, and new bookmarks; users can still remove saved bookmarks.
- Rejected submissions containing more than four images instead of silently dropping extras; comment attachments are denied across both `image` and `images` fields.
- Poll voting rejects an omitted/blank `option_index` instead of coercing it to zero (the first option).
- Added source-level regression assertions in `scripts/test-membership-tier.mjs`. These do not substitute for authenticated E2E, RLS integration, or manual mobile checks.
- Verify GitHub checks on the **final** branch commit before changing draft status. Never deploy the pending migration without explicit authorization.

## Video moderation limitation
- The server currently requires a caption for video uploads (`videoPath && !text` rejects the request). This is intentional fail-closed text moderation; the endpoint does not analyze the video bytes with the image/text moderation request.
- The new empty-post guard allows photo-only posts, but does **not** override the video-caption requirement. Do not advertise captionless video posting until a dedicated video safety workflow is designed and tested.
- Staging QA must verify a captioned video succeeds only after text moderation, and captionless video is rejected.

## Release blocker: HoopFeed expiration semantics
- `app/api/hoopfeed/moderate/route.ts` assigns `2100-01-01T00:00:00.000Z` to newly created posts and reshares. That conflicts with the previously specified 24-hour HoopFeed expiration behavior.
- The newly added expired-content checks operate on the stored `expires_at` value; they cannot expire posts whose expiration is set decades ahead.
- Before release, reconcile the product decision for the unified feed and verify all writers, readers, cleanup jobs, and reshare behavior consistently use the chosen expiration semantics. Include a clock-controlled integration test for the boundary and verify existing rows are handled safely.
- No automatic lifetime change was made in this security-audit branch because doing so without examining existing feed readers and persistence could unexpectedly hide content.

## Staging verification matrix
1. For each role (Player, Fan, Coach, Scout, Agent, Club Admin), verify Free cannot post and active Pro/Premium can create a text post, image, video, poll, comment, reaction, bookmark, and permitted reshare.
2. Check Fan Free/Pro/Premium review restrictions: Fans never write reviews; Fan Pro teaser only; Fan Premium full reviews.
3. Verify non-admin roles cannot pin or publish official news; Admin can. Moderator alone does not inherit Admin.
4. Verify content moderation rejects flagged content for all roles; failures must not publish. Verify report/block workflows.
5. Verify expired posts and followers-only posts are not accessible through guessed IDs, direct API calls, or signed media URLs; validate PR #464/#473 together.
6. Check role-specific dashboards, Fan HQ, Team HQ, Agent HQ, live games, subscriptions, and logout/session restoration separately.

No production data changes, merges, or deployments authorized.


## Confirmed production HoopFeed check/like RLS mismatch (read-only inspection, 2026-11-11)

The user-reported error "That check didn't go through" originates in `app/feed/page.tsx` when direct client-side INSERT/DELETE on `feed_post_checks` fails. Live `pg_policies` inspection found that `player feed checks insert` restricts INSERT to `p.account_type = 'player'`, paid subscriptions, `fp.expires_at > now()`, and `can_view_player_feed_post(fp.author_id)`. Thus unified HoopFeed roles other than player are rejected by database RLS even if the UI grants feed access. This is a **confirmed** server authorization mismatch, not yet an authenticated reproduction of the exact reported session.

A second blocker: the live `feed_posts` SELECT policy `player experience feed read` still requires `can_view_player_feed_post(author_id)`, which may impose old follower-based visibility. The `feed_post_checks` SELECT policy uses the same function. A safe correction must align all three policies with unified community visibility and paid-role entitlements, preserve moderation/expiry constraints, and verify the function, subscription edge cases, and admin override before any migration is applied. Other social tables' INSERT policies are less restrictive: `feed_poll_votes` and `feed_post_bookmarks` only require ownership. **No live SQL was modified.**

Release verification must include real signed-in Player, Fan, Coach, Agent/Scout, Club Admin and Admin accounts for visibility, check/uncheck, and denial on unpaid accounts. Do not claim the likes bug fixed until the policies are migrated and authenticated behavior passes.

## Product decision: permanent unified HoopFeed (confirmed 2026-11-11)

Owner confirmed unified HoopFeed posts remain permanently available; no 24-hour expiration. The branch now inserts new posts and reshares with `expires_at = NULL`, drops the old 24-hour database default in the **unapplied** unified-feed migration, and removes legacy expiry predicates from feed/check/comment SELECT RLS and interaction endpoints. The migration also replaces the follower/country-gated legacy post and comment read policies and the player-only check INSERT policy. Existing post rows are **not bulk modified**; the new read policies no longer hide older posts solely because their historical `expires_at` is in the past. Moderated/unapproved posts remain restricted. No production data or schema changes were made.

Remaining release gates: migration dry-run and RLS authorization tests in an isolated environment, current-head CI results, authenticated end-to-end tests for paid and free roles including checks, comments, polls, bookmarks, reshares, and admin moderation. The migration must be reviewed and applied separately; do not mark the live likes bug fixed until it is applied and verified. No merge or deploy authorized.

### Permanent-feed follow-up audit

Historical migration `20261007150000_founder_legal_security_support_analytics.sql` includes a dashboard analytics counter named `feed_posts_24h` with `WHERE expires_at > now()`. That legacy metric will undercount permanent posts with NULL expiration. It is an analytics compatibility follow-up, not a reason to reintroduce post expiration. Update the analytics function and any consumers in a separate reviewed migration before claiming all permanent-feed metrics are aligned.

Production has not received the new migration. Its old `feed_posts` and `feed_post_checks` RLS policies continue to enforce expiration/follower restrictions until an authorized deployment and migration. The staged migration is intentionally schema-only and does not rewrite historical expiration timestamps.
