# HoopCheck stabilization patch — 2026-11-09

Full launch remains on hold. This patch does not close #366, #189 or #130.

## Changes

- Expire session-cache reads after 12 seconds, preserve auth invalidation, and prevent stale failures from clearing newer reads.
- Track app-owned Back/Forward history and direct-entry fallbacks; Next App Router supplies no history.state.idx.
- Avoid forced reload on first service-worker activation while retaining one reload for an existing worker replacement.
- Evaluate fan-group moderation with the existing per-group RPC under the verified caller JWT, matching RLS. Errors deny moderation.
- Include subscription expiry and verified administrative access in dashboard entitlements.
- Verify administrative access before showing membership choices, show included Premium, retain existing subscription management and expose load-error retry.
- Wire regression and browser screenshot checks into CI. Existing browser scripts accept an optional installed Chromium executable.

No pricing or schema changes are included.

## Validation

Build, TypeScript, bundle audit, hub theme pairing, six stabilization tests, the existing entitlement matrix and four plan tests pass locally. Lint passes with 144 existing warnings. Production dependency audit returns no vulnerabilities.

Real App Router Back/Forward, direct-entry fallback, company overflow and reduced motion pass at 390px/1440px in both themes. Seven role fixtures pass mobile DOM checks for five visible 24px SVGs and feed destinations in both themes. Administrator fixtures show included Premium without purchase choices. Team discovery and profile editing pass mobile/desktop checks. The loader reduced-motion assertion now waits for the media-query style update before checking the same exact value. Player-completion browser flow passes.

Synthetic sessions and mocked APIs are not real-account/database acceptance proof. Physical iPhone/Safari/PWA installation, native billing/TestFlight and measured Lighthouse targets remain unverified. Screenshots are generated under artifacts/stabilization and uploaded by CI, not committed.

## PR audit

All 22 open PRs were fetched for metadata/diff/description and returned workflow runs. Local merge-tree checks found 12 branches with conflicts. This is release triage, not exhaustive line-by-line review of every stale branch. Historical green CI alone does not establish current integration or product acceptance.

| PR | State | Latest returned workflow conclusions |
|---|---|---|
| [#367](https://github.com/jacoriejay-afk/Hoopcheck/pull/367) | Draft | success, success, success |
| [#365](https://github.com/jacoriejay-afk/Hoopcheck/pull/365) | Draft | success, success |
| [#364](https://github.com/jacoriejay-afk/Hoopcheck/pull/364) | Open | success, success |
| [#363](https://github.com/jacoriejay-afk/Hoopcheck/pull/363) | Open | success, success |
| [#361](https://github.com/jacoriejay-afk/Hoopcheck/pull/361) | Draft | success, success, success |
| [#288](https://github.com/jacoriejay-afk/Hoopcheck/pull/288) | Draft | success, success |
| [#287](https://github.com/jacoriejay-afk/Hoopcheck/pull/287) | Draft | success, success |
| [#209](https://github.com/jacoriejay-afk/Hoopcheck/pull/209) | Draft | success, success |
| [#208](https://github.com/jacoriejay-afk/Hoopcheck/pull/208) | Draft | success, success, success |
| [#207](https://github.com/jacoriejay-afk/Hoopcheck/pull/207) | Draft | success, success, success |
| [#194](https://github.com/jacoriejay-afk/Hoopcheck/pull/194) | Draft | success, success, success |
| [#193](https://github.com/jacoriejay-afk/Hoopcheck/pull/193) | Draft | success, success |
| [#191](https://github.com/jacoriejay-afk/Hoopcheck/pull/191) | Open | success, success |
| [#168](https://github.com/jacoriejay-afk/Hoopcheck/pull/168) | Draft | failure, failure |
| [#167](https://github.com/jacoriejay-afk/Hoopcheck/pull/167) | Draft | failure, failure |
| [#166](https://github.com/jacoriejay-afk/Hoopcheck/pull/166) | Draft | failure, failure |
| [#126](https://github.com/jacoriejay-afk/Hoopcheck/pull/126) | Draft | success, success |
| [#125](https://github.com/jacoriejay-afk/Hoopcheck/pull/125) | Draft | success, success |
| [#124](https://github.com/jacoriejay-afk/Hoopcheck/pull/124) | Draft | success, success, success, success |
| [#123](https://github.com/jacoriejay-afk/Hoopcheck/pull/123) | Draft | success, success, success |
| [#122](https://github.com/jacoriejay-afk/Hoopcheck/pull/122) | Draft | success, success |
| [#119](https://github.com/jacoriejay-afk/Hoopcheck/pull/119) | Draft | No returned PR runs |

- **#119:** HOLD: no returned PR workflow runs; 2 local merge conflicts; no Xcode/device/TestFlight evidence.
- **#122:** HOLD: 12 local merge conflicts; immediate deletion assumptions superseded by fail-closed main; schema/two-account moderation acceptance missing.
- **#123:** HOLD: 3 local merge conflicts; native shell/billing rollout lacks physical iOS proof.
- **#124:** HOLD: 2 local merge conflicts; Apple IAP contract is not verified StoreKit/App Store implementation.
- **#125:** HOLD: 1 local merge conflict; live hub lifecycle/reconnect/poll evidence missing.
- **#126:** HOLD: 14 local merge conflicts; shared motion changes overlap already shipped fixes.
- **#166:** HOLD: latest launch gate fails lint; 1 local merge conflict; global density visual matrix missing.
- **#167:** HOLD: latest launch gate fails lint; 7 local merge conflicts; measured LCP/CLS/performance targets unproven.
- **#168:** HOLD: latest launch gate fails lint; 6 local merge conflicts; visual acceptance missing.
- **#191:** HOLD: 2 local merge conflicts; authenticated route/slug overlap matrix missing.
- **#193:** HOLD: 2 local merge conflicts; desktop redesign screenshots 1024/1280/1920 and route review missing.
- **#194:** HOLD: draft; stale branch touches shared auth; authenticated Free/Pro/Premium matrix required.
- **#207:** HOLD: draft; isolated migration and two-account career-follow/change/unfollow evidence missing.
- **#208:** HOLD: draft; current-base browser/auth/layout acceptance required.
- **#209:** HOLD: unfinished deletion lifecycle, safety moderation, verification, public-page privacy and language coverage.
- **#287:** HOLD: draft notification groundwork; migration validation, preference UI, batching/digest and delivery acceptance missing.
- **#288:** HOLD: draft roster groundwork; dispute-column protection, manager/player UI, moderation and integration tests missing.
- **#361:** HOLD: draft explicitly unfinished; Turnstile widget, durable rate limiting, secrets and non-production schema tests required.
- **#363:** HOLD: 4 local merge conflicts in current main; country flags/card redesign needs resolved current-base visual review.
- **#364:** Auth expiry fix is incorporated with race regression tests in stabilization candidate; do not merge duplicate after candidate.
- **#365:** HOLD: draft; company/business pages and admin workflow require form/security/schema/legal acceptance.
- **#367:** HOLD: draft; advertised audit-only but diff adds client-only Agents HQ, role nav and live filtering; server route/action matrix and poll acceptance incomplete.

PR #165 was already merged; current inline SVG navigation is covered by the added browser tests.

## Remaining acceptance

- #366: complete server-authorized role dashboards/actions, optimistic reactions, live lifecycle/polls/reconnect/moderation and real-account tier matrix. #367 contains feature code beyond its audit-only description.
- #189: broad route loading/error/scroll restoration, roles and actual devices remain open beyond the Back/worker fixes here.
- #130: existing Pre-Sign page is a local checklist, not the requested private report, offer form, saved checks or redacted share card. Season/roster/claims/followers/report-visual acceptance remains. Issue text about fan review visibility conflicts with established Fan Premium entitlements; preserve existing paid access until the intended contract is reconciled.
- Safety: finish the protected deletion lifecycle and reporting/blocking/verification acceptance. Company/native/performance drafts still require their documented acceptance.

No deployment success is claimed in this source report. Verify exact-commit CI and post-deployment smoke evidence separately. Operational diagnostics are kept local and excluded from this public repository.

## Release hold discovered during extended validation

The existing full theme/browser sweep returned failure records while exiting zero. It reports contrast problems, Fan HQ scaffold copy, and stale/mismatched UI acceptance contracts. The script now exits nonzero for any failed/missing route result, so CI cannot present these findings as a successful gate. Do not merge or deploy this patch until those failures are resolved and the final exact commit passes. The targeted checks above do not override this broader failure.

During this audit, upstream main independently merged #367 and #368. Those commits were integrated into this branch without conflicts; the 22-PR inventory is a timestamped starting snapshot, not a claim that #367 remains open. The incorporated upstream code still needs the complete real-account role/action acceptance matrix.

Extended validation also corrected the Fan HQ translation fallback (real English copy now precedes humanized unknown shared keys) and replaced legacy primary-button white/orange overrides with the existing accessible semantic token pair. The later fan-route sweep reports zero scaffold hits on the checked routes. Six executable regression tests cover these changes. The remaining broad theme failures still block release.

New PR #369 appeared during the audit. Its returned entitlement, launch and CI runs pass at its inspected head. The diff also modifies search-filter synchronization in addition to the advertised feed CSS/expiry work. Hold it for current-base screenshot and filter-navigation acceptance; no merge is performed here. PR #370 is this draft stabilization branch.

