# Sequential SDK 54 tooling remediation

Continuation of prototype head 204c56911227867504b0e62ee191cab5d9dd6825.
This report supersedes the remaining mobile advisory counts in REPORT.md and
FORK-REVIEW.md; those files retain historical baseline evidence.

Candidates were applied sequentially in separate commits:

1. sharp 0.35.5 (a6883b41): clean npm ci, 191 native tests, TypeScript,
   web/iOS/Android Hermes exports and PNG/JPEG decode probes passed. Browser
   media, player profiles, feed and design suites passed in light/dark modes.
   Lock changes limited to sharp and its platform binaries. Node >=20.9 is
   required (local Node 24.22.1, CI Node 22).
2. glob 14.0.2 (5417f827): override only ^13.0.0 consumers, retaining legacy
   glob 7. Clean npm ci, 191 native tests, TypeScript, both native prebuilds,
   generated iOS permission verification, fingerprint generation, sync/async
   traversal probes and all three platform exports passed. Glob brings
   path-scurry 3.0.0 and its own minimatch 11.0.9 subtree.
3. minimatch 11.0.1 (ececcdd9): override only ^9.0.0 and ^10.2.2 consumers.
   Retains legacy minimatch 3 and glob's ^11 dependency. Refreshed the stale
   node_modules/expo/node_modules/minimatch lock entry before npm resolution;
   npm removed its now-unused brace-expansion and balanced-match subtree.
   Clean npm ci and real fingerprint/CLI pattern consumers passed.

## Compatibility limits

Glob 14 and minimatch 11 cross Expo's declared dependency ranges. Minimatch 11
removes named makeRe and AST exports: it is not a universal drop-in replacement.
The tested consumers use minimatch, Minimatch and instance matching. Targeted
consumer tests are retained in scripts/tooling-compatibility.test.mjs; full
Expo config/prebuild/fingerprint/export and browser checks remain required.
No override is applied to legacy 3.x minimatch or 7.x glob consumers.

Expo 54.0.38, Router 6.0.24, RN 0.81.5, Metro 0.83.3 and React 19.1.0 are unchanged.
Application, authentication, membership, linking, asset and native StoreKit code
are unchanged. Decoder/image-size fork provenance verification still passes.
Full and production mobile audits are saved in candidates/; both report zero.
Root development audit is a separate unchanged scope (historically 8 findings).

Final local native tests: 194/194 (three additional tooling compatibility tests).
TypeScript, generated iOS permissions and entitlement matrix pass. macOS binary
compatibility and unsigned compilation must pass on the new exact CI commit;
prior-head six-workflow success is not substituted. CI now rejects any mobile
full or production audit finding and exercises the tooling tests on macOS.

## Preview and release restrictions

Vercel dpl_GNtUit6u6Lb2DuWioYxgEjPjSSfC was inspected through the connector:
READY, next.js, prototype commit 204c56911227867504b0e62ee191cab5d9dd6825,
URL next-biy7y15zx-hoopcheck.vercel.app, target null (non-production).
No connector deployment deletion action exists. Dashboard inspection redirects
to login, so removal remains blocked and is not claimed. No project settings or
production deployments were modified. Any automatic previews on push must also
be inspected. Keep draft/unmerged. No EAS, migrations, signing or Apple purchases.
