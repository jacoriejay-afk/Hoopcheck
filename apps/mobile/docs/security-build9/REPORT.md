# Build 9 dependency security prototype

Base: `db5c0063510dad5ce4e61055dfa155e3b8850e3c`.
Branch: `prototype/build9-decoder-image-size`. No merge or production changes.
Audit captured 2026-11-20 with Node 24.22.1 / npm 11.9.0, mobile lockfile scope.

## Changes and compatibility

Local CommonJS fork of decode-uri-component 0.5.1 replaces 0.2.2 for query-string
7.1.3. Local image-size 2.1.0 CommonJS parsers with Metro synchronous API wrapper
replace 1.2.1. See `../../vendor/README.md` for source provenance and limitations.
`.npmrc` packs local dependencies instead of linking; consumer-scoped overrides
use paths relative to the consumer package. No application behavior is edited.

All unrelated locked package versions are preserved. Expo 54.0.38 (SDK 54),
React Native 0.81.5, Metro 0.83.3 and React 19.1.0 remain unchanged.

## Exact audit findings

Counts are affected npm packages, including propagated findings, not distinct
advisories. Before: 18 (5 high, 13 moderate). After: 15 (1 high, 14 moderate).
Decoder, query-string and image-size findings disappear; expo-router drops from
high to moderate because other transitive findings remain. Local forks are not
registry artifacts; a clean audit entry is not proof that forked code is safe.
Raw before/after JSON is retained alongside this report.

| Package | Advisory | Severity | Vulnerable range | Before → after |
| --- | --- | --- | --- | --- |
| decode-uri-component | [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) — decode-uri-component: Denial of service via exponential decoding of malformed percent-encoded input | moderate | `<=0.4.2` | present → removed |
| decode-uri-component | [GHSA-qr28-fpjm-wq7f](https://github.com/advisories/GHSA-qr28-fpjm-wq7f) — decode-uri-component vulnerable to denial of service via quadratic replacement of percent-encoded runs | high | `<=0.5.0` | present → removed |
| glob | [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) — Glob: AbortSignal cancellation bypass allows post-timeout filesystem traversal | moderate | `>=9.0.0 <=14.0.1` | present → present |
| image-size | [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq) — image-size: JXL and HEIF parsers allow denial of service through infinite loops | high | `>=1.2.0 <=2.0.2` | present → removed |
| image-size | [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) — image-size: ICNS parser allows denial of service through an infinite loop | high | `>=0.6.3 <=2.0.2` | present → removed |
| minimatch | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) — minimatch has potential denial of service via globparts amplification | moderate | `>=7.0.0 <11.0.1` | present → present |
| sharp | [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj) — sharp inherited vulnerabilities in libvips: CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591 | high | `<0.35.0` | present → present |
| sharp | [GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c) — sharp: Vulnerabilities in libheif: GHSA-g89c-p67h-r497 and GHSA-2jg2-4ch7-h545 | high | `<0.35.4` | present → present |
| sharp | [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) — sharp : Vulnerability in librsvg dependency CVE-2026-96889 | high | `<0.35.5` | present → present |

Remaining affected packages: `@expo/cli`, `@expo/config`, `@expo/config-plugins`, `@expo/fingerprint`, `@expo/metro-config`, `@expo/prebuild-config`, `expo`, `expo-asset`, `expo-constants`, `expo-linking`, `expo-router`, `expo-splash-screen`, `glob`, `minimatch`, `sharp`.

Remaining independent advisories concern glob cancellation, minimatch amplification, and three sharp/libvips/libheif/librsvg findings. These are unresolved and outside this focused prototype. No SDK upgrade or broad audit fix was applied.

## Verification

- Clean `npm ci --no-audit`: pass, 874 packages. Earlier experimental locks
  failed and were replaced; the retained final log records the passing install.
- `npm run test:native`: 191/191 pass, including bounded hostile decoder/parser
  inputs, query-string routing and real Metro image-size API invocation.
- Additional native2 media policy tests: 7/7 pass.
- `npm run typecheck`: pass.
- Auth integration tests and Supabase URL validation tests: pass (fixture/local tests).
- Membership matrix: 10 role/tier cells plus edge cases, 22 entitlements pass.
- Upstream tarball comparison: image parser files are byte-identical to 2.1.0;
  decoder source differs only in the CommonJS export statement.
- Unsigned iOS compilation and Swift StoreKit native tests: **not run**.
  This host is Linux and has neither Xcode nor Swift. Existing macOS workflow
  `.github/workflows/ios-native-compile.yml` remains available for an eventual PR;
  no CI run, signed build, native runtime test or device verification is claimed.
  The prototype must not be considered native-compile verified until that job passes.

Commands run with fixture public configuration; no production calls or deployments.
The root entitlement test used a temporary link to mobile's installed TypeScript,
removed after validation. Existing membership/application code is unchanged.

## Complete platform exports

`@expo/agent-cli export --platform all --clear` completed successfully (exit 0).
Web bundle: 4.32 MB. Android: 2,278 modules; iOS: 2,280 modules.
Both native outputs are complete Hermes bytecode bundles, approximately 7.21 MB each.

- `android`: 7210733 bytes, SHA-256 `e301ce7030cfa4fda3f28f91528dca1a863b0f29942ce2e5c93056ee37562c0f`.
- `ios`: 7210535 bytes, SHA-256 `936194c380d8be4e1d7de3dd47e588d6c34d10b6ec4b42d6768b2f68768ea74a`.
