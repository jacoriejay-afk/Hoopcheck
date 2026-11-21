# Native HoopFeed poll creation

The native composer now offers Discussion and Poll. Polls retain the website's
2–4 distinct answers, 60-character answer limit, 2,000-character question limit,
and text-only rule. Invalid/duplicate answers keep Post disabled. Draft question
and answers stay editable after a moderation failure; a confirmed success clears
them and reloads the real feed. No answer, result or participation count is invented.

Publication uses the existing bearer-authenticated moderation endpoint with
`kind=post`, `post_kind=poll`, `poll_options` JSON and the community audience.
Both question and answers still undergo the server's safety checks and membership
authorization. It uses the current endpoint's actual `{ allowed: true }` success
contract; ordinary posts do not return an ID. There is no new direct database
write, entitlement bypass, news-publishing control or media path.

Verification: real request/FormData tests cover canonical fields, trimming,
case-insensitive duplicate validation, bounds, malformed responses and moderation
errors. Intercepted native browser flows cover both themes, disabled duplicate
answers, adding/removing an option, rejection/draft retention, successful creation,
and a subsequent feed read displaying the new poll. Existing voting, comments,
Checks, sharing, saves and Reels tests continue to run. TypeScript, native/auth/URL
suites, changed-file lint and local web/iOS exports pass. Remote CI must pass on
the pushed head; native keyboard/touch/VoiceOver remain physical-device checks.

No native dependency, server/schema, production record, EAS, OTA or signing change.
