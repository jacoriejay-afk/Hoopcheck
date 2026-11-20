# Fork review and CI follow-up

Target: `fix/build9-iphone-repairs`, verified remote tip
`db5c0063510dad5ce4e61055dfa155e3b8850e3c`. Prototype starts at `74b6e6a8`.

## Review conclusions

- Decoder uses upstream 0.5.1's single-pass malformed-run algorithm, with only
  `export default function` converted to `module.exports = function`. No runtime
  dependencies or install scripts. Corrected its TypeScript declaration to
  `export =` and marked the local fork private. Removed unused upstream tool config.
- Image parsers and MIT license are byte-identical to upstream 2.1.0. The wrapper
  restores Metro 0.83.3's callable CommonJS API for Buffer and synchronous filename
  input, including the SVG path input used by Metro. It does not implement legacy
  callbacks or global queue configuration; the installed Metro consumer uses neither.
- Both versions are fork metadata, not claims of unmodified registry packages.
  `vendor/provenance.json` records full upstream tarball SHA-256 and every vendored
  file hash. `verify-dependency-provenance.mjs --upstream` fetches exact npm versions,
  checks tarball hashes, compares parser/decoder source and licenses, and verifies
  the packed installed copies actually resolved by query-string and Metro.
- `install-links=true` is required for reproducible packed local installations.
  Clean install and provenance pass with npm 11; CI additionally tests npm bundled
  with Node 22 on Linux and macOS. No unrelated locked dependency versions changed.
- Third-party vendored sources are excluded from application ESLint; source hashes,
  upstream comparison, targeted deadline regressions and end-to-end exports verify
  them instead. Application lint and all existing checks remain blocking.

## Remaining advisories and remediation feasibility

The refreshed mobile audit remains 15 affected packages: 1 high and 14 moderate,
versus baseline 18 (5 high, 13 moderate). See raw audit JSON and REPORT.md for every
advisory ID, severity and range. Removal of local-fork audit entries is corroborated
by upstream source comparison, not treated as proof by itself.

- **sharp 0.34.5**: GHSA-f88m-g3jw-g9cj (libvips), GHSA-rgj7-g3m4-5g8c
  (libheif), GHSA-wq5f-xc86-pv6w (librsvg). The combined fixed version is 0.35.5;
  it requires Node >=20.9, compatible with the Node 22 mobile CI toolchain. It is a
  development-only fixture image generator here. A compatible fix is plausible
  without changing SDK/RN/Metro, but crosses a 0.x minor boundary and needs the
  PNG/JPEG/avatar/feed/media browser fixtures and platform binary installs tested.
  This review leaves it unresolved rather than silently expanding the prototype.
- **glob 13.0.7**: GHSA-3g3m-2fjr-6pw4, vulnerable >=9 through 14.0.1;
  fixed candidate 14.0.2 is a major version beyond Expo's declared ^13 ranges.
  **minimatch 10.2.6** (plus Expo CLI's installed copy): GHSA-g3hv-75wg-m249,
  vulnerable >=7 and <11.0.1; fixed candidate 11.0.1 is beyond ^10 ranges.
  Registry engine metadata for both fixed candidates allows Node 18/20/>=22.
  Engine compatibility alone does not establish API compatibility with Expo config,
  prebuild, fingerprint and CLI. Scoped source backports or tested major overrides
  may be possible while retaining SDK 54, but no in-range fixed releases resolve
  these advisories. They remain unresolved; a supported SDK upgrade is outside scope.

No Apple purchase flags, signing, EAS, deployment or production settings are changed.
The six workflows requested are HoopCheck CI, Mobile App Checks, NATIVE-2 Security
Tests, VERIFY-1 entitlement matrix, HoopCheck Launch Test (Final Gate), and Unsigned
iOS Native Verification. The latter runs Swift StoreKit core tests and a real
unsigned simulator compile. PR run outcomes are recorded on the draft PR; a local
Linux export is never represented as native compilation.
