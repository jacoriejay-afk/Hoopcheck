# Build 9 Phase 2 — Premium Courtside 2.0

Design approval pending. This branch starts at the verified PR #755 head 1ffaa7b2 and contains presentation work only; no new Phase 3 contracts. Existing historical branch names in the baseline do not authorize further Phase 3 work. No production, deployment, EAS build or merge.

Home has a personalized court hero, live/upcoming games before followed teams, and existing feed previews/actions. HoopFeed has a court identity banner, more generous media/post spacing and continuous card corners. Live Games uses the same court identity and larger tabular scores with a strong live rail. HoopGroups uses the shared hero and larger club identities. Player Profiles has a larger approved avatar, display name, genuine experience/team summary, existing privacy-aware details, career statistics and Passport. Missing values remain explicit; no invented athlete statistics or photos. Existing authored arena art is decorative rather than represented as player content.

Existing theme preference controls, semantic text/background colors, orange accents, missing-data/error states, membership checks, backend calls and navigation remain intact. Existing Reanimated fade on the personalized Home hero is brief and reduced-motion-aware, uses opacity on the UI thread, and never animates virtualized rows. Physical release-build performance is not established by simulator screenshots.

## Verification and screenshots

Local TypeScript and native tests (215/215) passed on the initial presentation changes. Final browser/iOS export and exact-head CI results are recorded in the PR discussion. Native screenshot workflow uses a separate entry in a disposable macOS checkout to load the real routes and providers with synthetic offline API responses. It does not import into the normal Expo Router entry, add a production fixture flag, change Supabase/RLS, or touch hosted data. Artifacts contain actual iPhone simulator PNGs for Home, HoopFeed, Live Games, HoopGroups and Player Profiles in light/dark. Their completion and visual inspection must be confirmed before claiming screenshots delivered. Browser screenshots are separately labelled and cannot substitute for iOS.

The test profile has no athlete photo; real profiles continue to display approved photos with initials on missing/error. Fixture scores, names and career information are synthetic test data only. Native screenshots establish rendering on a simulator, not live-backend, physical-device, Apple Sandbox or release performance acceptance.

Stop after this Phase 2 review. Wait for owner design approval. Build 9 release blockers documented in reports/build9/release-cleanup remain unchanged.

Local final verification: TypeScript PASS; native tests 215/215 PASS; all twelve browser suites PASS in light/dark, including 320-point required-control checks; iOS Hermes export PASS; screenshot fixture entry iOS export PASS; ESLint zero errors/125 inherited warnings. Browser regression correction waits for the existing profile's career-access request to settle before asserting the next private route makes only RPC reads. No privacy assertion was removed.

Concurrent-session boundary: PR #755 base advanced with Phase 3D work during this review. PR #756 is therefore retargeted to review/build9-phase2-baseline-20261121, which freezes 1ffaa7b2 plus deployment-disable configuration only. No new Phase 3D changes were imported.
