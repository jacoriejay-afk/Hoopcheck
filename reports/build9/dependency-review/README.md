# Build 9 mobile dependency investigation — 2026-11-20

Starting remote head: `75e8ff724a49491c2b282332766162d9a6944e39`, PR #744, `fix/build9-iphone-repairs`.

No safe dependency fix verified within Expo SDK 54, React Native 0.81.5 and the current Metro contract. No manifests, lockfiles, overrides, advisory exclusions or application behavior changed. Keep release blocked on residual findings. This report supersedes the earlier assumption that image-size 2.x necessarily breaks the callable default import: its default export works, but its removed **filename API** breaks bundling.

## Paths and findings

| Package | Installed path | Finding / disposition |
| --- | --- | --- |
| decode-uri-component 0.2.2 | expo-router 6.0.24 → query-string 7.1.3 → decode-uri-component | GHSA-vcc3-ghjq-m6fr (malformed decoding exponential DoS), GHSA-qr28-fpjm-wq7f (quadratic replacement DoS). Patched 0.5.1 is ESM and incompatible with query-string 7's direct CommonJS function call. |
| query-string 7.1.3 | expo-router 6.0.24 → query-string | Inherited high severity from decoder, not an independent advisory. Latest stable 7.x still requires decoder ^0.2.2. |
| expo-router 6.0.24 | direct dependency; also deduplicated through Expo CLI | Inherited high from query-string and moderate findings through expo-constants/expo-linking. Latest stable 6.x still depends on query-string ^7.1.3. Audit recommends Router 58.0.32: outside authorized SDK scope. |
| image-size 1.2.1 | expo 54.0.38 → @expo/metro 54.2.0 → metro 0.83.3 → image-size; RN 0.81.5 → community-cli-plugin 0.81.5 → same Metro | GHSA-5p2g-fcmc-qvqq (JXL/HEIF infinite loops), GHSA-w3rx-r6r6-pgpr (ICNS infinite loop). No patched published 1.x; 2.0.3 rejects Metro filename input. |

Registry checked with `npm view`: latest stable matching Router 6 = 6.0.24, query-string 7 = 7.1.3, image-size 1 = 1.2.1. Decoder fixed version = 0.5.1. Downgrading image-size would leave the ICNS advisory. No forced major upgrades or source patches attempted.

## Candidate verification

Candidates were installed **only in /tmp**. A repository copy used a Metro-scoped `image-size: 2.0.3` override for verification. Nothing from its package files was copied back.

- `probe.cjs`: verifies PNG buffer API, Babel default import semantics, decoder ESM default behavior, query-string stringify compatibility, query-string parse failure with the patched decoder, and image-size filename rejection versus baseline filename success. PASS means the compatibility assessment is reproduced, not that candidates are safe.
- `metro-assets.cjs`: candidate-only tests of actual Metro `getAssetSize`: valid PNG/SVG dimensions, empty/non-image behavior, and malformed zero-length ICNS entry rejection in a child process bounded to five seconds. These pass in the isolated image-size 2.0.3 copy.
- Full candidate Metro/Hermes iOS export **FAILS** after 2,273 modules: `expo-router/assets/unmatched.png: The "list" argument must be an instance of SharedArrayBuffer, ArrayBuffer or ArrayBufferView.` Metro `src/Assets.js:169–173` passes an ordinary asset filename to image-size. The v2 parser expects bytes. This proves the narrower buffer tests are insufficient.
- Candidate audit decreases highs from four to three, but that does not justify the broken export. See `rejected-candidate-audit.json`.
- Baseline `npm run typecheck`: PASS. Baseline `npm run test:native`: PASS (27 test files, zero failures reported by Node 24.22.1). Isolated candidate TypeScript and native tests also pass, illustrating the export regression they do not cover.
- Baseline `npx --yes @expo/agent-cli@latest export --platform ios --output-dir /tmp/hoopcheck-build9-ios --clear`: PASS, 2,280 modules, 7.2 MB `.hbc` Hermes bundle. Candidate command also used `--max-workers 2`.

Reproduce the contract probe from repository root after mobile `npm ci --ignore-scripts`:

```sh
npm install --prefix /tmp/hoopcheck-dependency-probe --ignore-scripts --no-audit decode-uri-component@0.5.1 image-size@2.0.3
node reports/build9/dependency-review/probe.cjs
```

## Reachability and residual risk

Router's inspected JavaScript uses query-string only for `stringify` in `build/fork/getPathFromState.js` and `getPathFromState-forks.js`. Incoming query parsing in `getStateFromPath-forks.js:parseQueryParams` uses URLSearchParams; path decoding uses built-in decodeURIComponent with fallback. No application imports of query-string or decode-uri-component were found. Thus the known vulnerable decoder is not reached by the inspected normal incoming-link query path. The app does register `hoopcheck` and HTTPS associated links. Static inspection does not prove all runtime/transitive paths unreachable, and the vulnerable package remains installed; no advisory is suppressed or treated as cleared. A future parser call or routing change can expose process/UI-thread denial of service from attacker-controlled encoded input.

image-size is used by Metro build/development tooling, not the native runtime's remote-image decoder. A malicious repository/dependency image or asset supplied to a reachable development server can stall that Node process. Metro's image extension list excludes ICNS/HEIF/JXL, but image-size sniffs content: a crafted file with an accepted extension can still reach those parsers. The candidate test deliberately uses ICNS bytes labeled PNG. Reviewed source assets are a narrower exposure than arbitrary user media, not a security fix. Keep development servers private and review asset/dependency changes; these operational practices do not clear the advisories.

Baseline production audit remains **4 high, 13 moderate**. The high entries represent the two vulnerable dependency families above. Resolution requires upstream compatible backports or a separately authorized, fully tested Metro/Expo migration; no safe in-range registry update was found. Native tests stub bridges; no Xcode/simulator/device execution was available here, and no physical-iPhone acceptance is claimed.

No EAS, deployment, production access, migrations, billing changes, merge, or advisory suppression performed.
