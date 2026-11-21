# Build 8 integrated candidate — release readiness

Branch: `codex/build8-integration`. Source integration commit:
`859f794474ee03665fe0fe81dfaf475018c185b8`.
This is the single current integration report; earlier design/feature reports are
historical evidence. The exact final candidate HEAD and remote check links are
recorded in the integration PR's readiness record after checks complete (a report
cannot contain its own commit hash).

## Decision

Code is integrated for review and automated compilation with Apple billing
disabled. **Not yet approved for a production-configured Build 8/TestFlight build.**
Before requesting an authorized device build, select and verify the target
backend/environment, review the migration deployment plan, and confirm signing,
remote version/build number and build profile. No EAS build or distribution has
been started. Physical-device verification is the purpose of the subsequent
owner-authorized test build, not something browser fixtures can prove.

## Exact inputs and reconciliation

Verified base #731, pinned design #729. Current main is an ancestor of #731.
A clean read-only combined tree was applied as an ordinary patch on a new branch
from #731; no source branch, PR or main was merged/rebased/modified.

| Input | Commit |
| --- | --- |
| Main | `1d4b30eec938ce3028495f7313fcfe524bcc4589` |
| #720 reconciliation | `2354cafd0c8a2729ad6e6b16ef30ed6660c259ad` |
| #721 startup | `d0b87b1ed92cd2130001b224b6e39493a5faa447` |
| #722 media/profile photos | `a4a384559a575bad680b88fd134888e920d89375` |
| #723 player privacy | `c7118ae729022d0b09c6e3f2abde4e5f9a97fcc5` |
| #724 identity isolation | `d4a5bb16c681eb65161b4a24d3fc187cb5d0788d` |
| #725 verified links | `c2ecb3783f6f4d12ea39b49d77389f6fef78c804` |
| #726 auth operation ordering | `39943b35a23d1cd7759588eaba2967bd1be82574` |
| #727 MFA | `ca82f1e427c9c93af87c61275497acb19d2c4efb` |
| #728 StoreKit bridge | `b3f9fdaec0f1d0e3afeb9f53b6979a37e5e0c895` |
| #729 design | `980c72ebcbd03260f658966b7ccc6383d21c0520` |
| #730 verified Apple backend | `9645897d24da31ce66ab28ba90f07d17b82fae4b` |
| #731 purchase/restore/coordinator | `b7d62acc7799f32b3eb1ffcb6b7507b77a208606` |

The newer media editor/composer, privacy-aware player screen, serialized auth,
MFA providers, membership screen and root transaction observer are retained.
#731's actual native Button text rendering is preserved along with #729's card,
branding, keyboard, artwork, About/Connections and navigation presentation.
No legacy screen replaces the newer implementations.

`lib/membership-tier.ts` is byte-identical to #731 (Git blob
`a828e32f263cf7efb4df5101623ff06323507fe9`). There is no integration delta from #731
in server auth, Apple verification, API handlers or migration SQL. The existing
membership_entitlements/membership_authorizations source selection and canonical
resolver remain authoritative. Device callbacks never grant access optimistically.

## Handoffs and incomplete native scope

Account exposes Owner HQ and Ambassador HQ as **website** links. The native
handoff screen explains that website sign-in and authorized roles are required;
no native role claim or access grant is made. No bearer token/session is put into
the URL or copied to the browser. The destination website retains its server-side
authorization. Actual website login/role outcomes still need authorized accounts.

Existing web handoffs remain for fan profiles, company information, pre-sign,
advanced account/group controls and other absent native features. Rich entity
profile tabs/cover/follow composition and full native website feature parity are
not claimed complete. Purchasing remains unavailable without the explicit server
and database flags/configuration; this integration did not enable either.

## Local verification on this integrated source

- Root and mobile TypeScript: pass (`npx tsc --noEmit`, mobile typecheck).
- Full repository lint: zero errors, 125 pre-existing warnings; not represented
  as warning-free. New handoff files were also inspected directly.
- All 25 native test files pass, covering startup recovery/modal ownership,
  identity and operation ordering, media/privacy/moderation, MFA, membership
  coordinator/screen, pending/cancelled/restore behavior, drafts and preferences.
- Native auth integration and Supabase URL validation pass.
- Backend contracts pass: StoreKit verification/ownership/trial rules, bootstrap
  auth, MFA enforcement, Apple AASA, ambassador invoice/refund behavior.
- Canonical entitlement matrix: ten role/tier cells and 22 entitlements pass.
- Browser results: all eleven localhost suites pass in both themes where supported. They
  cover discovery/navigation, feed/Reels/post/comment/poll moderation, live games/
  chat/predictions, groups, profile edits, theme persistence, media/photo drafts,
  player privacy, MFA and membership controls. New assertions cover both HQ
  handoffs without opening production pages. Synthetic HTTP traffic is intercepted.
- Local web export passes. Native compilation is checked on the exact pushed
  head by the macOS `Unsigned iOS Native Verification` workflow, including Swift
  product policies, Expo prebuild, permission checks, Pods and unsigned
  `xcodebuild` for a simulator. Linux has no Xcode; JS exports are not represented
  as compilation. Current-head outcome is recorded on the PR.

## Required migrations — isolated tests only

Source delta from current main contains these three migrations, in this order:

| Migration | Purpose | SHA-256 |
| --- | --- | --- |
| `20261118162305_player_profile_country_privacy.sql` | Public player RPC and opted-in current-country/avatar visibility | `dc113752fc0662f1edc94d0e7447f543cb213e3ce8230c6dd6216f84c3e5d331` |
| `20261118162456_opted_in_mfa_enforcement.sql` | Opted-in AAL2 policies/request enforcement | `212beab0423eae69baa0fe8416b45b6c35fbe1c42cf793ac66bc14fedf1f62a5` |
| `20261119043244_storekit_membership_sources.sql` | Independent Apple ownership/trial records and effective membership views | `c6c48c49769d25c903bb29bd8efa7c7781038a6c87b2e520d22974c26348a708` |

Exact SQL was expanded through the existing fixture `\ir` directives and executed
in fresh in-memory PGlite databases: player_profile_privacy, opted_in_mfa and
storekit_membership_isolated all pass. Negative MFA fixtures also pass: missing
MFA enforcement is detected, and an existing conflicting PostgREST pre-request
hook rejects migration rather than being overwritten.

CI repeats the exact fixtures on isolated PostgreSQL 16 databases, including
negative MFA, ownership/RLS/trial/idempotency/refund checks. These are synthetic
baseline fixtures, not a complete clone of the production schema or a hosted
Supabase deployment rehearsal. No hosted migration was run. Applied production
migration state was not inspected; do not infer it from files in Git.

Before deployment approval: inventory the target's migration history and existing
PostgREST hook, confirm schema/dependency compatibility, rehearse all three against
a disposable copy of that target, verify privacy/MFA denial behavior and existing
Stripe memberships, prepare rollback/backups, then seek separate migration
approval. Do not apply the MFA hook over another hook without reconciliation.

## Unresolved release gates

1. **Target backend:** native profile RPCs, MFA enforcement and the new membership
   views/API routes must exist in the chosen test environment. The new bootstrap
   fails closed when membership_entitlements cannot be read. A build pointing at
   an unprepared backend will not demonstrate functioning paid/core flows.
2. **Apple billing:** database migration/configuration and protected isolated Apple
   credentials are not deployed here. APPLE_IAP_ENABLED remains disabled by
   default; database enabled defaults false. Real Apple Sandbox purchase,
   notification, restore, refund, upgrade/downgrade and cross-provider entitlement
   parity remain release gates. Website provider/billing integration was explicitly
   still a follow-up in #731; do not enable Apple based on native fixtures alone.
3. **Live access:** no full live authenticated website-to-native comparison or real
   account/RPC integration test has been performed. Earlier limited local website
   Following/About fixtures did not disable middleware auth, but do not close this.
4. **Signing/build identity:** repository version is 0.2.0; EAS uses remote version
   management and production auto-increment. No signing, remote build number or
   production profile/environment selection was changed or claimed verified.
5. **Physical behavior:** simulator compilation and browser flows cannot establish
   TestFlight startup, touch responsiveness or device-specific native behavior.

## Physical iPhone test plan for a separately authorized build

Use an isolated configured backend and test accounts for player/fan/free/paid,
MFA-enabled, and two distinct identities. Keep billing disabled unless a separate
Sandbox test authorization and configuration are complete.

- Record device/iOS version, build number, source SHA and backend target. Cold/warm
  launch, slow/offline session/storage/font reads, retry and restoration; reproduce
  the reported freeze. **The freeze is not claimed fixed.**
- Exercise onboarding/app lock/Face ID/background return, MFA enrollment/challenge/
  recovery/removal, logout/account-switch races and private-state clearing.
- Navigate every tab, directories, profiles, edit/save/error drafts, HoopFeed,
  photo/video creation, Reels, comments/replies/checks/saves/polls, Live Games/chat/
  predictions and club membership/moderation. Check denied roles and failure recovery.
- Verify keyboard/composer position, safe areas, scrolling/swipe-back, sheets,
  VoiceOver/large Dynamic Type/Reduce Motion, both themes, camera-roll permissions,
  AVPlayer/audio/media expiry and native share sheet.
- Verify membership status with billing disabled; under separate Sandbox approval,
  purchase/cancel/pending/restore/refund and account isolation. No production payment.
- Open both HQ handoffs as unauthenticated/unauthorized/authorized website users;
  confirm website authorization and app return. Confirm incomplete features are
  clearly website handoffs and never represented as native completion.

## Restrictions observed

No PR/main merge, production deployment/migration, Apple billing enablement,
EAS build, OTA publication, signing mutation or TestFlight submission performed.
