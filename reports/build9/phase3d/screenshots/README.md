# Actual localhost RN Web screenshots

All eight images are browser captures at 320×812 using synthetic fixtures, in
light/dark themes. They are not generated mockups, simulator screenshots, hosted
player data or physical-device evidence. The default build has roster/career
candidates OFF. Reproduce with verify-season-contracts-browser.cjs after exporting
EXPO_PUBLIC_ROSTER_RESEARCH_CANDIDATE=0 using the isolated fixture URLs in CI.

- historical-season: exact season membership, without current direct club mixing.
- owner-team-links: private verified/current/date-bounded affiliation; no proof URL.
- default-roster: honest unavailable state, with zero undeployed-contract reads.
- default-passport: owner preview and expected web-only export fallback.

Prior [Phase 3C screenshots](../../phase3c/screenshots/) remain historical
before-reference images. Their roster/career positive fixtures assumed source-only
candidate contracts; they are not evidence of hosted availability. Fixture identities
and scroll positions differ, so these are behavior comparisons, not pixel-matched
before/after claims. Real simulator evidence is linked separately if its runtime
acceptance passes. No physical iPhone verification is claimed.
