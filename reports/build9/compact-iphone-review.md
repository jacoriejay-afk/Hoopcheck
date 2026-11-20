# Build 9 compact iPhone continuation

Starting remote head: 803d278d92b2246060c5824b2b9dc90bd60026ab.

## Changes and evidence

Shared compact editorial headings on Home, HoopFeed, Live Games and HoopGroups;
Home search grouping and consistent discovery row icons; player avatar/identity
composition with wrapping name and position chip; tabular game scores; feed status
messages can wrap independently of tabs. Group search dismisses the keyboard on drag.
Authentication, membership gates, queries, reporting, payments and migrations are unchanged.
This is an integrated visual refinement, not proof that the full requested premium
native redesign or physical-device review is complete.

Screenshots in compact-iphone/ show all five surfaces in light and dark at 320x812.
They render the actual React Native Web app with synthetic fixture responses. They
are browser evidence, not UIKit simulator or physical iPhone screenshots.

The existing eleven browser suites now default to 320px, configurable through
NATIVE_TEST_WIDTH. Screenshot checkpoints assert that required controls and headings
stay within the viewport. Coverage includes permission denial, private-profile
masking, owner changes, retained drafts on failures, moderation, fan membership,
live game predictions/chat, search, navigation, media, MFA and theme persistence.

## One integrated validation run

PASS: root/mobile TypeScript, lint (0 errors, 125 inherited warnings), 185 native
tests, 83 security/bootstrap/membership/checkout/StoreKit/AASA/theme tests,
entitlement matrix, theme surface/pair checks, full website production build with
bundle/theme/certificate tracing, Metro web export and Metro/Hermes iOS export.
All eleven browser suites pass. Membership and MFA initially failed because the
local static server lacked SPA fallback; only affected checks were retried after
correcting the test server. Directory capture checkpoints were then added and
those two fixture suites rerun. No full-suite repeat or repeated dependency audit.
See compact-validation.json and compact-browser.json.

No local Xcode, simulator or Postgres is available. Isolated SQL CI gates and unsigned
native compilation require exact-head remote verification; local exports do not
establish native compilation success.

## Dependency gate

One mobile production audit: 4 high, 13 moderate entries; full machine-readable
result is compact-mobile-audit.json. No lockfile or dependency edits made.
image-size 1.x registry releases end at 1.2.1, within the advisory range through
2.0.2; installed Metro uses the default-callable CommonJS API. Patched
image-size 2.x is not a drop-in override. decode-uri-component latest 0.5.1 is
ESM, while the installed query-string chain uses CommonJS. Audit recommends
Expo/Router major upgrades for multiple entries, outside the SDK 54 constraint.
No unverified override, audit suppression or incompatible SDK upgrade applied.
SDK 54-compatible dependency clearance remains blocked.

## Release decision

Keep PR #744 draft and unmerged. Full premium native design acceptance, physical
review, dependency clearance, exact-head CI/unsigned compile, and separate inherited
backend rollout/client compatibility approvals remain gates. No EAS build, OTA,
production mutation, migration, billing change or StoreKit activation performed.

Screenshot review follow-up: unavailable scores now use body typography, while
reported numeric scores retain tabular display styling; status is a separate
caption. Mobile TypeScript, targeted lint, Live Games browser regressions and
web/iOS exports pass after this correction. The local fixture server was restarted
after export replaced its working directory. Prior-head unsigned iOS run
44685657936 completed successfully, including simulator compilation; that success
does not validate this continuation's new head.
