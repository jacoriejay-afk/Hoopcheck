# Build 9 consolidated repair candidate — not release ready

PR: https://github.com/jacoriejay-afk/Hoopcheck/pull/744 (draft, unmerged).

## Reconciliation

Starting Build 9 head and release/build8-final were identical at c0b77ba3.
Main 9e11cb7bf6976174a49562cabf21dddee2f40ffb was merged without conflicts
in 981e3ab7. Its Apple association changes were already present in the release
tree, so this reconciliation adds ancestry without replacing approved fixes.
No separate Build 9 foundation commits were found on the specified branch.
The consolidated PR includes 55 inherited Build 8 commits, including backend and
migration files; it must not be treated as a native-only production deployment.

## New implementation commits

- 01a8173a: profile saves pin owner JWT; membership rejects invalid JSON responses;
  directory reads abort after 15 seconds; disposed startup retry is ignored;
  transport/ownership/username regression coverage.
- bd60cf36: shared touch-feedback cards, keyboard-aware floating navigation,
  profile account retry and keyboard avoidance, accessible busy skeletons,
  disabled button accessibility, keyboard dismissal on Home/feed/player profile.
- 078f5e48: remove unused group row import.

The adjacent file inventories distinguish this run from all inherited PR files.
No dependency, migration, billing, StoreKit enablement, EAS or OTA changes made.

## Causes and limits

Membership used response.json() unconditionally. HTML, empty and primitive JSON
responses now produce a bounded retryable service error; no response body leaks.
Profile retry previously only reloaded profile revision: after bootstrap failure
there is no owner ID, so it never retried account verification. It now does.
Profile writes also used mutable session authorization after an owner read;
explicit captured authorization prevents account switching from redirecting writes.
Search queries had no abort deadline and could leave loading unresolved on normal
abort-capable transports. Both public username RPC and other directories now abort.

The inherited release report documents pending privacy migrations providing
get_own_profile and search_public_players_by_username. Their absence is a known
backend compatibility blocker, not solved by client retries. No live authenticated
production reproduction or deployment was performed. Do not claim all P0 causes
resolved on production. Existing privacy boundaries and fan gates remain enforced.

## Integrated local evidence

- Mobile TypeScript and root TypeScript pass.
- Native suite: 27 test files pass; targeted P0/startup tests also pass.
- Auth/URL/native2: 9 test files pass.
- Bootstrap/membership reader/checkout policy/AASA: 4 test files pass.
- Canonical membership matrix: 10 role/tier cells, 22 entitlements pass.
- Full lint: zero errors; 126 warnings initially, including one new unused import
  subsequently removed and verified by targeted lint. 125 inherited warnings remain.
- Metro iOS export passes, producing a 7.2 MB Hermes .hbc bundle.
- Metro web export passes. Generated unsigned iOS prebuild and permissions pass.
- Root production dependency audit: zero findings.
- Mobile production dependency audit: 4 high and 13 moderate entries. High entries:
  decode-uri-component, query-string, expo-router, image-size. npm recommends a major
  Expo Router update for the URI dependency chain. Do not blindly override image-size
  to v2: Metro currently imports its v1 default-callable API. These findings remain
  blockers pending compatible remediation and validation.

Browser, remote CI and Vercel results for the exact final head are recorded in the
PR description after completion; do not infer success from this interim record.
The initial local website build failed fetching Google Fonts under restricted
network; a network-enabled retry was started. No Xcode, Swift, physical iPhone,
or simulator runtime is available locally. Unsigned native compilation is delegated
to the existing macOS GitHub CI workflow, not represented as local device evidence.

## Remaining delivery gates

The requested substantial five-screen redesign is incomplete: this run provides
incremental reusable interaction and accessibility improvements. Comprehensive
native handoff parity, new theme/loading behavior tests and physical review still
need completion. Historical Build 8 browser tests are regression coverage, not
proof of a new premium iPhone design.

Leave unmerged: separate migration rollout approval, compatible dependency
remediation, exact-head required checks, and completion of native design/interaction
scope are required. Physical-device checks remain pending. Build 9 is not ready
for a production-configured TestFlight build. No production mutation authorized.
