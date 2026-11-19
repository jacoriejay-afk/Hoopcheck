# Native profile editor

`/account/edit` replaces the text/profile-cover website handoff with native
controls. Player, coach and general account fields match the website's editable
allowlist and limits. Eight cover choices use the existing Auth metadata key.
First/last name, professional years, username, verification, account role,
membership and verified affiliations are read-only or absent from mutations.

Reads and updates use the caller's Supabase client, explicit own profile ID and
existing RLS. The current server profile role determines the update allowlist;
an input role or user metadata cannot select privileged fields. Fan/agent/scout
profiles do not receive a publish/visibility mutation. Coaching experience is
coach-only; self-reported player fields remain separate from verified affiliation.
No entitlement, moderation, schema or permission changes are introduced.

Profile cover updates verify the user, then use that captured JWT for the Auth
write. The mutable SDK session cannot retarget an in-flight save to a later
signed-in user. Only `hoopcheck_profile_cover` is sent; no permission metadata is
written. Account-switch/unmount guards also prevent stale save feedback from
appearing under another identity.

Unsent edits are in the existing memory-only identity-scoped draft store, with
an 8,000-character cap for this bounded form and a key restricted to its owner.
Same-user revalidation/navigation retains them. Sign-out or identity change clears
them. Failures retain drafts; users can explicitly discard and reload server state.
Profile and appearance save independently, so one is not reported as the other's
success. Requests have bounded deadlines and unconfirmed writes are labeled as such.

## Evidence

- Real Supabase-client/fetch tests cover exact own-row queries, field projection,
  current-role handling, private roles, limits, failures and acknowledged writes.
  The cover test changes the active account between verification and update and
  proves the original JWT remains bound to the original owner.
- Isolated 390×844 browser tests pass for players in light/dark, a free fan and
  a coach: locked identity, role fields, failed save/draft retention, successful
  save, cover preview/save, navigation retention and discard/reload. Every remote
  HTTP/WebSocket request is intercepted. No hosted records or accounts are used.
- Read-only production metadata confirms the selected profile columns exist;
  no production profile values are inspected or changed for testing.

Physical iPhone keyboard, VoiceOver and long-form scrolling remain unrun. Photo
crop/upload, identity changes, security/billing and verification flows retain
their existing website workflows; this PR does not claim those native gaps are
completed. No native dependency, migration, EAS build, OTA or signing change.
