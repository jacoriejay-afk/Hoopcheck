# PR #729 — final pre-Build 8 design audit

2026-11-19. This report supersedes the earlier readiness summary. No full-parity
or physical-device completion claim is made. See [gallery](comparisons.html).

## Completed design work

All 82 existing `after/` captures were visually reviewed in seven contact sheets,
then checked against their screen sources. `reviewed-82.json` records the reviewed
filenames. Original #721 and #729 baselines remain preserved.

This pass fixes the duplicate HoopGroups content title, top-aligns and compacts
password recovery, adds its Email accessibility label, aligns women's team/league
metadata typography with men's profiles, and uses website-style hexagonal
artwork for directory shortcuts. Following/Followers now have display headings
and orange network artwork consistent with the actual website reference.
Scrollable search/auth/editor forms dismiss the keyboard on drag while retaining
first-tap controls. Native keyboard position still needs device verification.

The shared Button incorporates #731's exact text/number/fragment/render-function
handling and its actual-component tests; its 52pt touch minimum is preserved.
Compact cards and theme-aware inputs remain from #729. This prevents a design
integration from restoring the raw native-string child bug fixed by #731.

The old player capture's `undefined years` came from a fixture missing a declared
nullable field. The fixture now supplies `years_pro: null`. We did not replace
#723's newer privacy-aware player screen with a patch to the older screen.

## Authenticated website comparisons and limits

`compare-website-fixtures.cjs` ran against the **actual local Next website** with
`HOOPCHECK_THEME_TEST_MODE=false` and fixture-only Supabase configuration. External
browser traffic was intercepted; no production sessions or records were used.

- Following used an isolated synthetic client session and public-list RPC rows
  shared with the native design fixture; Following, Design Club and Design Fan
  were asserted before capture in both themes.
- About was captured from the actual website in both themes.
- A guest request to protected Dashboard still redirected to login in both themes.
  No middleware auth bypass was enabled or added.

`website-fixtures/` contains those four reference images. The gallery pairs them
with native Connections/About. These are **client-session component comparisons**,
not proof of server-authenticated production access. The website fixture's global
navigation/profile hydration is incomplete; its HOOPCHECK NETWORK heading is not
proof that a real fan's role chrome matches. Full live authenticated comparisons
of Account, Dashboard, Feed and role HQs remain incomplete. The earlier secure
browser login was unavailable. Native isolated authenticated workflows have much
broader coverage, but do not substitute for those website comparisons.

Reproduce locally from repository root with fixture public URL/key, telemetry
optionally disabled, and `HOOPCHECK_THEME_TEST_MODE=false`:

```sh
NEXT_PUBLIC_SUPABASE_URL=https://fixture.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=fixture-publishable-key HOOPCHECK_THEME_TEST_MODE=false npx --no-install next dev --hostname 127.0.0.1 --port 3010
# From apps/mobile in another shell:
DESIGN_SCREENSHOTS=docs/native-design-final/website-fixtures node scripts/compare-website-fixtures.cjs
```

## Reconciliation with #730 and #731

#730: `9645897d24da31ce66ab28ba90f07d17b82fae4b`.
#731: `b7d62acc7799f32b3eb1ffcb6b7507b77a208606`, branch
`feat/native-membership-restoration`, stacked on #730.

A read-only merge simulation against #731 is clean (design source `7fcff521`,
combined tree `1249c9094a670db24977260f72bd374304676398`). New Connections/About route
handling was separated from the membership route array additions; existing auth,
MFA, privacy, StoreKit and billing logic was not replaced. The shared button fix
is identical to #731's implementation. Neither branch was merged or rebased.

The simulated combined tree was archived to `/tmp/hc731-design-final` with real
locked mobile dependencies (not symlinked Expo dependencies). Combined TypeScript,
all 25 native test files and auth/URL test suites pass. Web and iOS Hermes exports
pass. This is not Xcode compilation or real StoreKit validation. All eleven combined browser suites pass: discovery, feed, Live Games, groups,
profile editing, appearance, media, player privacy, MFA, membership and design.
The standalone source passes TypeScript, lint, 17 native test files, auth/URL
tests and seven browser suites. Exact-head remote CI/Vercel results are recorded
on the PR after completion. `integration-731/` contains separately labeled combined evidence;
these screens include features still owned by other PRs, not copied into #729.

## Remaining code issues and coverage

- Standalone #729 remains based on #721. The clean combined tree is tested
  separately; it must become an approved integration candidate before release.
- Full website feature parity remains incomplete: entity tabs/cover/follow
  composition, native fan profile/contact controls, and pre-sign/reviews overview
  remain absent or explicit website handoffs. These are not fixed by styling.
- The generic route capture harness intentionally records some account/access
  error states. Successful feature fixtures are separately named. A screenshot
  count is not evidence that all content, overlays and scroll positions work.
- Full protected website visual comparison and real data/RPC verification still
  need an authorized test environment/session. No production authentication or
  permission bypass was performed.
- StoreKit infrastructure/real Sandbox gates belong to #730/#731. This design
  work does not apply their migrations, enable purchasing or validate billing.

## Requirements awaiting owner decisions

No approved **native** Owner HQ or Ambassador HQ requirements were found in the
reviewed sources. This is a scoped finding, not a claim that none exist anywhere:

- `docs/ambassador-hq/AMB-1-implementation.md` (tracked #642/#643) defines web
  access, agreements, attribution, ledger and payout operations, not native UI.
- `apps/mobile/docs/build-8-readiness.md` lines 77 onward requires endpoint-level
  native authorization verification and says web code/links do not prove flows.
- Issue #599's owner-approved HQ organization covers Player/Fan/Team HQ; it does
  not approve native Owner/Ambassador screens.
- `app/owner-hq/page.tsx` and `app/ambassador-hq/page.tsx` are web implementations;
  their existence is not native screen approval.

Owner decisions needed: whether each HQ belongs in Build 8, the approved native
screen/action list and feature owner, role-authorized API contracts, and which
financial/admin operations must remain on the web. No HQ screen was invented.
Full parity versus explicit handoff decisions are also needed for the remaining
feature gaps above.

## Physical iPhone-only verification

Cold/warm TestFlight startup and the reported freeze; touch/swipe/back gestures;
notch/home-indicator/landscape safe areas; real keyboard position/dismissal and
modal/sheet interactions; VoiceOver, Dynamic Type and Reduce Motion; native photo
picker/media formats/AVPlayer/audio/expiry/share sheet; Face ID/app lock and
onboarding; alternate icons; OAuth/deep-link/browser return; real Apple Sandbox
purchase/restore behavior. Browser exports do not prove these.

**The frozen TestFlight screen is not claimed fixed.**

## Readiness for integration into Build 8

Ready for code-integration review against the pinned #731 snapshot, subject to
current-head checks. **Not ready for final integration/release sign-off:** live
protected website coverage, remaining feature decisions and physical iPhone gates
are open. No merge, EAS build, OTA, production change or migration performed.
