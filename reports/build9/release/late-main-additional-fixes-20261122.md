# Newest main website fixes staged in Build 9 — 2026-11-22

- Supersedes the old main web source baseline with the newer main 7ee4e2089c2d8016940e165804ea137344d45f05, scoped to safe source reconciliation on draft PR #838 only.
- Imported newer `app/hoopgroups/page.tsx` with auth-change cancellation, account-state clearing, stale response suppression and channel response identity checks. Added exact current-main regression tests; kept HoopGroups backend feature flag gated and review-only SQL unapplied.
- Retained Build 9's provider-aware `getEffectiveMembership` and profile privacy boundaries. Removed **only** the duplicate `id="career-passport"` from the decorative profile anchor; `PlayerJourney` remains the unique hash target. Updated both audited regression scripts from main to fail on duplicate IDs.
- Corrected one mobile CSS selector from decorative `.hc-court` to isolated `.hc-my-court`, preserving integration-only career editing and team review styling instead of replacing with smaller production file. Added scroll margin for the single anchor.
- Explicitly **did not** copy newer main `app/layout.tsx` removal of `MfaSession`, `app/profile/page.tsx` direct raw subscription lookup, or `package.json` removal of pinned Apple server billing library and certificate tracing. Build 9 keeps all of those security/billing protections.

No production deploy, production Supabase/Stripe changes, EAS or App Store submission. Wait for fresh exact-head CI and independent #836 six-check merge gate; #755 release HOLD pending schema-equivalent PG17, real authenticated AAL1/AAL2, legacy app compatibility, physical iPhone, Apple Sandbox and signing.
