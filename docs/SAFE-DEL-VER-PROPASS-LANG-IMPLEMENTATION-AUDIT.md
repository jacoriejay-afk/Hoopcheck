# SAFE-1 / DEL-1 / VER-1 / PROPASS-1 / LANG-1 implementation audit

Audit target: `feat/safety-deletion-verification-public-career-language` (based on current source files on that branch).
This is an engineering gap audit, not a completion claim. No production database changes or deployment are performed by this document.

## Status summary

| Workstream | Existing foundation | Blocking gaps |
|---|---|---|
| SAFE-1 safety and moderation | Separate profile/review/live-chat/team-group report tables and endpoints; HoopFeed has a profanity check | No unified content report model/queue; report entry points do not cover all requested content; no block relationship or mutual interaction enforcement; no consistent moderation hold/review pipeline; admin reports page is profile-report focused |
| DEL-1 account deletion | New 30-day request ledger migration | Existing `/api/account/delete` still immediately cancels Stripe, deletes storage and deletes the Auth user; no password re-verification, grace period, sign-in cancellation, write lock, safe finalizer, review anonymization or complete FK cleanup |
| VER-1 player verification | Existing player/coach verification page, Stripe Identity flow, player request table, admin page and moderation RPC | Current flow allows coaches and multiple forms of proof/identity verification; player proof is not restricted to exactly one permitted proof; rejection reason/notification/resubmission and secure evidence lifecycle need verification and implementation |
| PROPASS-1 public career page | Profile data and career-history features exist | No `/p/[username]` route found; no default-off public career-page preference, 404 gate, share card, or public-data allowlist |
| LANG-1 language | Language provider has a locale registry, browser-language detection, profile preference persistence and readable fallback work on this branch | Locale key coverage and every user-facing surface still need an automated completeness audit; fallback readability is not equivalent to complete translations; date/number/plural formatting and no-reload behavior need runtime tests |

## Verified source observations

### SAFE-1
- Existing report storage is fragmented across `profile_reports`, `review_reports`, `fan_live_chat_reports`, and `team_fan_group_reports`.
- `app/admin/reports/page.tsx` reads `profile_reports`; it is not a unified queue for all content types.
- `app/api/profile-reports/route.ts` accepts a free-form reason rather than the requested fixed category set plus optional note.
- `app/api/review-reports/route.ts` has its own fixed reason list and review-specific behavior.
- A profanity regex exists in `app/api/hoopfeed/moderate/route.ts`; this does not establish a consistent hold-for-review pipeline across reviews, responses, comments, group posts and live chat.
- No block table, block API, or block enforcement was found in the inspected application and migration source.

### DEL-1
- `app/api/account/delete/route.ts` currently retrieves/cancels a Stripe subscription, removes storage objects, then calls `auth.admin.deleteUser`.
- The current endpoint checks only the literal `DELETE` confirmation; it does not reauthenticate with the user's password.
- The new `account_deletion_requests` migration is only a ledger. It is not wired to the API or UI and has not been applied to Supabase.
- The finalizer must preserve and anonymize reviews before profile deletion, retain club responses and Trust Score inputs, and handle all profile foreign keys deliberately. It must not cancel paid subscriptions as part of the deletion request.

### VER-1
- `app/verification/page.tsx` permits both player and coach verification and includes Stripe Identity, public evidence URL, uploaded document, and additional notes.
- `app/admin/verification/page.tsx` exposes the existing request queue and calls `moderate_player_verification`; its current UI does not provide the complete requested rejection-reason and notification/resubmission workflow.
- Private evidence bucket access policies and signed-link access need explicit security review before this workflow is changed or declared safe.

### PROPASS-1
- No `app/p/[username]` route was found in the inspected branch source.
- Public career page must be built as an explicit allowlist, with default-off visibility and a server-side 404 when disabled. It must not reuse a broad profile query that could expose private fields.

### LANG-1
- The provider's locale registry includes the requested languages (English, Spanish, Turkish, Azerbaijani, Greek, French, German, Italian, Portuguese and Russian), as well as additional locales.
- This audit did not establish complete translation coverage across every route, modal, validation message, server response or system state. Missing-key fallback must remain a fallback, not a substitute for translations.
- Do not claim language work complete until all target locale keys and formatting behavior are checked and runtime-tested.

## Required safe implementation order

1. Complete schema inventory and RLS review for every affected table, storage bucket and RPC. Confirm actual deployed schema before writing destructive migrations.
2. Finish DEL-1 request/cancel lifecycle first: password reauthentication, idempotent request creation, immediate privacy/write restrictions, sign-in cancellation, 30-day scheduler/finalizer, review anonymization, FK cleanup, and tests. Never run the existing immediate-delete route as the new flow.
3. Build SAFE-1 canonical report/block schema and server-enforced block rules; migrate or bridge existing report sources; add moderation holds and a unified admin queue with audit events and generic reporter notifications.
4. Narrow VER-1 to player-only one-proof submissions; secure private storage, admin approve/reject with reason, notifications, resubmission, and badge/suspension behavior.
5. Add PROPASS-1 opt-in public page using a strict public-field projection and share-card rendering.
6. Complete LANG-1 translation-key inventory, locale formatting, signed-out defaults, profile preference precedence and automated/runtime coverage.
7. Run lint, typecheck, production build, migration checks, RLS/security tests, API tests, and end-to-end tests before merging or deploying.

## Release gate

Do not merge or deploy this branch as a completed SAFE-1/DEL-1/VER-1/PROPASS-1/LANG-1 release until the above acceptance criteria are implemented and verified. The deletion migration is not yet applied, and no production data has been modified.
