# Account deletion implementation notes (DEL-1)

## Current production behavior found during audit

- `POST /api/account/delete` currently accepts only the literal confirmation `DELETE`.
- It does not re-enter or verify the account password.
- It retrieves the Stripe subscription and cancels it immediately.
- It removes storage objects and calls `auth.admin.deleteUser` in the same request.
- The profile page currently presents a permanent-delete confirmation dialog and signs the user out after the endpoint succeeds.
- This behavior conflicts with the requested 30-day cancellation window and the instruction not to cancel/refund subscriptions as part of account deletion.

## Data model findings

The live schema has profile foreign-key relationships across feed posts/comments, fan feed posts/comments, follows, fan group membership/moderators, live chat, player contact requests/messages, profile claims, notifications, reviews, and subscriptions.

Both `reviews.author_id` and `womens_team_reviews.author_id` are non-null foreign keys to `profiles.id`. To retain reviews and Trust Scores after account deletion, the finalization path must anonymize authors in place before deleting the profile, rather than cascading the profile delete into those rows. The review schema currently has no author display-name snapshot column.

The `subscriptions` row has a non-null `user_id` foreign key. It must be retained or detached in a deliberate, schema-safe way; the deletion request must not call Stripe cancellation. Store billing state must remain governed by the relevant App Store / Play Store subscription controls.

## Required implementation sequence

1. Add a deletion-request record with requested-at, scheduled-for, prior profile visibility, status, and audit timestamps. Enforce one active request per user.
2. Require a fresh password verification server-side before accepting the request. Never trust a client-side password check.
3. On request, make the account non-public and prevent normal write actions while keeping authentication available for the 30-day cancellation flow.
4. On successful sign-in during the grace period, cancel the pending request and restore the saved profile visibility. Do not automatically change subscription state.
5. Build an idempotent, service-role-only finalizer with a dry-run/reporting mode. It must explicitly preserve and anonymize reviews, retain Trust Score inputs, release sole-admin team claims, remove fan-group moderator assignments, and remove personal content/data according to the approved retention rules.
6. Only after the relational cleanup succeeds, remove private storage and delete the Supabase Auth user. Fail closed and keep a retryable deletion state if any step fails.
7. Add admin visibility for pending deletion counts and scheduled dates, but no admin cancellation action.
8. Add tests for password mismatch, repeat requests, cancellation by sign-in, failed cleanup retry, review anonymization, team claim release, fan-group moderator removal, and subscription preservation.

## Safety status

No production SQL or migration has been applied for DEL-1. No production data has been changed. The existing immediate-delete endpoint must not be considered compliant or released as part of this work until the full lifecycle above is implemented and tested.
