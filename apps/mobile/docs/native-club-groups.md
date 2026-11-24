# Native club groups

The native HoopGroups entry uses the existing canonical `/team-hub/groups`
directory and `/team-hub/groups/[teamId]` routes. It implements the website's
current club fan groups, not the proposed eight-category community-group schema.
No community creation, deduplication migration or membership-rule expansion is
introduced.

All verified signed-in roles can browse the RLS-protected directory. Detail access
uses the current user's own membership row and the existing moderator RPC; an
`is_member` field in a summary cannot grant access. Only fan members can compose
posts/comments or report posts; appointed moderators retain existing read/pin/
remove access without receiving fan posting rights. Moderator removal requires
an explicit confirmation. Leaving warns fan moderators about the existing
co-moderator cleanup rule. Full member/moderator administration uses the existing
website tools.

Mutations use the existing authenticated `/api/fan-groups` endpoint and moderation.
No direct client table inserts or permission changes are added. Private posts,
comments, signed media and access snapshots are not persisted. Auth, offline and
focus changes conceal content; visible membership is revalidated periodically.
Stale permission responses cannot override a later join/leave/refresh.

Directory/posts/comments use deterministic bounded pages. Group posts retain
their existing permanent history; HoopFeed expiry is not applied to them. Images
use the existing `fan-group-images` Storage RLS and exact group/owner object paths
with short-lived signed URLs; they do not use the separate HoopFeed media API.

## Draft lifecycle repair

Chat and group-comment children can unmount during account revalidation or view
switching. Their in-progress text now uses a bounded, memory-only draft store
partitioned by actual session identity. Same-user refresh retains drafts;
sign-out/account changes clear them. No draft is written to disk. Each hook
subscribes to its own string, avoiding whole-screen rerenders for unrelated typing.

## Verification

- Seven real-Supabase-client/fetch tests cover directory scope, forged summary
  membership, moderator boolean handling, published-only permanent posts,
  comments, moderated API writes, exact signed-image paths and fail-closed errors.
- Two draft-store regressions cover refresh/sign-out/identity isolation, bounded
  values/keys and subscription cleanup.
- Isolated 390×844 React Native Web tests pass in light and dark for a **free fan**:
  directory/search, verified join, moderation rejection/draft retention, post,
  comments, report and leave with private content removed. A non-fan cannot query
  posts. An appointed non-fan moderator can read/pin/confirm removal and cannot
  compose fan posts. A forged summary membership never starts a private query.
- The integrated Live Games, feed/Reels, directory/search and appearance suites
  pass against the same fixture export. Chat drafts survive switching panels and
  comment drafts survive closing/reopening their view. All external requests and
  websockets are intercepted; no real messages, hosted records or payments occur.

TypeScript, native/auth regressions, changed-file ESLint and local iOS export must
pass on the final pushed head along with CI/Vercel. Physical iPhone touch,
keyboard, VoiceOver, actual authenticated RLS/moderation/storage, membership
revocation, and image renewal remain release verification. This does not prove
the Build 7 freeze repair or full native product parity. No EAS build or OTA.

For local browser verification, use the fixture variables in `native-community.md`,
serve its web export on localhost port 8094 and run
`node scripts/verify-club-groups-browser.cjs`.
