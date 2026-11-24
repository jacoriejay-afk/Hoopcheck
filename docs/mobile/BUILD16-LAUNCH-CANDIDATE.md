# Build 16 — launch candidate

Status: INTEGRATION STARTED; no signed build, deployment, migration, paid provisioning or public submission authorized by this change.

## Baseline
- Signed Build 15: Expo a6a96f2e-6a3a-46ce-94ba-fde45b88eb08, app 0.2.0, build 15, exact commit `0283d7d8e19277222db14e310721d020341db99b`.
- Combined integration PR #954 merged into `integration/build9-backend-completion-20261121`; #755 has the same head and is still a draft against main. Do not assume production deployment.
- Build 15 native workflow 45440765809 passed. Physical signed-in acceptance and TestFlight upload status not established here.
- Build 16 branch is based on the signed artifact's exact source, not an older design branch.

## Work order
1. Reconcile #915 HoopReels on exact base: existing draft records staged system camera and watch foundation, but provider HLS playback and SAFE-M1 are unverified; custom segmented camera, sound/editor/photo Reel flow and streaming ingest not complete. Keep `HOOPREELS_CREATE_ENABLED=false`, no raw video playback fallback, no public upload or paid provider. Verify safety and privacy before any separate activation. No need to launch public creation if gated provider/moderation remains unavailable.
2. Owner HQ and HoopGroups: verify genuine owner access, non-owner denial, scoped moderation, MFA requirements, no reliance on client metadata. Preserve canonical entitlements and real data.
3. Membership: compare app and deployed API contracts, six approved products, monthly 7-day trial once per eligible account, purchase/restore, refund/renewal, existing Stripe membership preservation, provider-specific management and account switching. No activation from test fixtures or fabricated proof.
4. Selectively port still-missing UI changes from #916; do not blindly merge the older divergent branch. #910 motion overlaps #954; compare individual behavior before porting. Test system/light/dark themes, safe areas, glass navigation, account layout, branding, feed post controls, and Reduce Motion. Do not fabricate remote typing.
5. Directory and live game data: verify honest freshness and status transitions, real logos, women's and men's coverage, group/game navigation, chat permissions and lifecycle. No invented data.
6. Ambassador HQ: reconcile #894 and actual signed terms before any production campaign or commission change. Draft records historical 50%/10% rates; owner has discussed other terms. Do not modify financial records, unpause campaign or assume a rate without signed agreement verification.
7. Reconcile backend/privacy/security and production compatibility, including open #755. Do not run unapproved migrations or modify production grants. Preserve existing users, Stripe records, memberships, owner permissions, report/block controls and legacy app compatibility.

## Release gates (all unverified for Build 16 at kickoff)
- [ ] Every candidate change reviewed against exact Build 15 source; regressions repaired; no duplicate merges.
- [ ] Exact combined head CI: root/mobile, entitlement matrix, privacy/security, launch gate, unsigned native compile and relevant runtime tests.
- [ ] Required hosted backend compatibility and genuine authenticated owner/nonowner verification, or explicitly documented launch-safe feature deferral.
- [ ] Owner's Build 15 physical feedback incorporated; then explicit budget/credit confirmation before a single signed Build 16.
- [ ] Signed Build 16 exact SHA, internal TestFlight upload only, no duplicate submission.
- [ ] Physical iPhone acceptance: auth, owner/nonowner, membership StoreKit sandbox/restore, accessibility, navigation, feed/groups/chat/camera and account deletion; no fabricated evidence.
- [ ] App Store review only after owner acceptance and applicable policy/security gates pass. Build 17 only if necessary for bug fixes/review requirements.

No feature is considered complete solely on the strength of this document. No paid infrastructure or plan upgrades; retain public HoopReels creation block until separately verified and authorized.
