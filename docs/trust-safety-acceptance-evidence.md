# Trust and safety acceptance test evidence

Use two disposable, adult test accounts in a non-production environment (Reporter A and Author B). Do not use real users or real sensitive content. Capture one screenshot per numbered step with the browser URL and visible success state; redact email addresses and tokens.

## 1. Report a review
1. Sign in as Reporter A and open a published review written by Author B.
2. Select Report, choose Harassment or abusive content, and submit.
3. Sign in as a moderator and open Admin → Content reports.
4. Confirm the row shows type, reporter ID, content snapshot, reason, status, and timestamp; mark it reviewing and resolve it.

## 2. Report a HoopFeed post
1. As Reporter A, open a post by Author B in player HoopFeed and report it.
2. Repeat for a fan post in Fan HoopFeed.
3. Confirm both types appear in the same admin queue with the submitted snapshot and reason.

## 3. Report a chat message
1. Join a test live-game chat as both test accounts and send a harmless test message from Author B.
2. As Reporter A, use the message's Report action and submit a reason.
3. Confirm the message and reporter appear in the admin queue.

## 4. Block a user
1. As Reporter A, open Author B's player profile and choose Block user; confirm the prompt.
2. Refresh player HoopFeed and Reviews. Verify Author B's posts/reviews are absent.
3. If Author B has a fan feed post, verify it is absent from Fan HoopFeed too.
4. Unblock and verify content returns.

## 5. Delete account
1. In Reporter A's Settings, open Delete Account and capture the warning screen.
2. Attempt deletion without typing DELETE; verify the destructive button remains disabled.
3. Type DELETE, confirm permanent deletion, and verify the user is signed out and cannot sign back in.
4. As moderator, verify authored profile/reviews/posts/messages are removed or no longer attributable, while only permitted safety/audit records remain.

## 6. Legal pages
1. Capture Settings showing links to Terms, Privacy, and Community Guidelines.
2. Open Terms and capture the zero-tolerance objectionable-content clause.
3. Open Privacy and capture the reporting/blocking data-handling section.
4. On signup, capture the Terms, Privacy, and Community Guidelines links next to consent.

Evidence status: These are reproducible acceptance steps, not claimed completed screenshots. Run them against a deployed preview with test accounts after the migration is applied. Never fabricate screenshots or claim app-store approval from code checks alone.
