# HoopCheck Phase 5 — release evidence and acceptance gates
Date: 2026-11-22. Track: Reels moderation, Live Games discovery, Scam Alert confidential triage and native Build 9.

## Changes in this Phase 5 branch

- **Reels:** new `/admin/safety-center` triages confidential Reel reports from the existing owner-and-moderator-protected `support_tickets` queue. A reviewer must inspect the post, attest independent review, and write at least 25 characters of evidence before `/api/admin/reel-moderation` accepts an audited removal.
- **Security:** `hide_approved_reel_for_moderation` is `SECURITY INVOKER`, executable only by `service_role`; the server validates the caller's Supabase bearer JWT via `auth.getUser` and existing `is_current_user_admin_or_moderator` RPC. The function atomically changes **only** an approved video post to rejected and inserts `reel_moderation_actions`. It cannot delete videos, expose private media, unhide a post, or publish a new one. The existing media-signing endpoint denies requests unless the source feed post is approved. Do not grant table/function access to client roles.
- **Scam Alerts:** the same queue filters security tickets, including suspicious-offer reports. Moderators can update ticket status through existing `admin_update_support_ticket`; no report becomes a public allegation, blacklist, or identity verdict. Public incident bulletins need a separate verified editorial/legal policy.
- **Live Games:** compact country and league shortcuts ranked by provider-reported live status and actual current chat presence. Existing membership enforcement, provider-only LIVE badges, local-time display, upcoming/open-chat checks, and fan predictions remain intact.
- **Reels public launch:** `NEXT_PUBLIC_HOOPCHECK_REELS_ENABLED` remains OFF pending physical-device, Apple and moderation acceptance. No intentional change to Stripe, purchases, installed Build 7/8 behavior, or live privacy policies.

## Isolated PostgreSQL rehearsal (HoopCheck-PR17-Test only)

The isolated project lacked `feed_posts` and `support_tickets`; minimal schema fixtures were created **in that separate test project**, then the exact reviewed SQL was applied. Checks confirmed:
- `reel_moderation_actions` has RLS enabled, no direct anon read, and nonprivileged clients cannot execute the moderation function.
- The function is **not** `SECURITY DEFINER`; `service_role` has EXECUTE.
- A service-role invocation with a valid test moderator and reported-video ticket unpublishes the test video, writes one audit event and refuses a duplicate action.
- Fixture changes were rolled back; the test video, ticket and audit records were all absent afterward.
- A review caught and removed an unnecessary read of `auth.users` from service-role execution. The authenticated HTTP route already verifies JWT identity; the foreign key enforces actor existence.

Production DB schema before rollout: `reel_moderation_actions` / `hide_approved_reel_for_moderation` must be checked for collisions and applied ONLY after the exact-head PR builds and Vercel preview pass. Verify RLS and function privileges again before serving new UI. Don't apply while previews/builds are failing.

## Current iOS evidence (Expo project 62f822cb-ab9a-42ba-8456-007d2822ef70)

Latest verified finished iOS STORE production build is **Build 8**, `f0dd9cd3-cee2-49a7-b541-5485144f377e`, version 0.2.0 (8), Git `c0b77ba3e7de5beb88cd588a8cfe506bec315e2b`, built 2026-11-19. **No completed or queued Build 9** was returned in the recent iOS builds. Build 9 drafts `#755` (backend/privacy ownership) and `#776` (native design) are not merged release evidence.

**Do not guess the iOS identity:** Expo build-history filtering shows different bundle identifiers on past releases. Build **6** succeeded for `com.online.hoopcheck.app`; Build **7 and 8** succeeded for `online.hoopcheck.app`. The current repository `apps/mobile/app.json` uses `online.hoopcheck.app`. The authoritative App Store Connect bundle and provisioning certificate/capabilities MUST be reconciled with the owner's approved public App Store listing and existing installation before Build 9. Never create new credentials for the other identifier at an interactive EAS prompt.

Expo had no current cloud iOS simulator sessions at inspection. No physical iPhone was available in this execution; Build 7 startup/touch freeze and on-device scroll, Face ID, OAuth, Reels video, deep links, chat and theme behavior remain unverified. An empty TestFlight crash feed is **not** proof that startup is safe. No new EAS build, upload or TestFlight submission was initiated.

## Release gates and necessary human acceptance

1. Exact-head CI: website TypeScript, lint, entitlement matrix, both theme screenshot runs, native tests, and secure API test script all pass; Vercel preview READY with correct SHA.
2. Production preflight: existing RLS and feed statuses preserved, verified new migration applied only after gates; signed URL media access denies unapproved posts.
3. Production smoke: /reels feature-off, /live-games, /scam-alerts, /support and admin safety page HTTP 200; anonymous and nonstaff moderation API calls rejected, no runtime errors. **Authenticated staff/ordinary-user end-to-end test is still required** (the tool has no prepared account sessions).
4. Owner approves the definitive iOS bundle identity, EAS/Apple Team permissions, associated domains and signing. The installed Build 7 source compatibility and unresolved function ownership in #755 must be settled through its separate reviewed migration path; no grants, ownership changes, privacy or RLS relaxation.
5. Real iPhone acceptance (iPhone running iOS 26, both themes): warm/cold startup and touches, scrolling, authentication/email verification, password reset, Apple/Google sign-in where configured, Face ID, privacy boundaries, Reels report/block/hide, Live Games updates/chat/predictions, push and safe area.
6. Apple Sandbox: seven-day monthly trial once per user, Pro/Premium activation, renew, cancel, refund, restore and account switching; verify web Stripe memberships remain separate from native StoreKit entitlements.
7. Only after all gates: queue the correctly identified Build 9, validate artifact/capabilities and TestFlight/App Store Connect rollout explicitly. No automatic promotion or store submission here.

## Rollback

The web Phase 5 change can be rolled back through Vercel promotion of a known-good deployment; preserve the moderation audit table as an incident log. Never automatically restore rejected posts on rollback—staff must independently review them. If the new migration fails before actions are recorded, halt web release and reconcile the isolated schema; no unrelated database policies or billing records are changed. Public Reels stays gated until acceptance.
