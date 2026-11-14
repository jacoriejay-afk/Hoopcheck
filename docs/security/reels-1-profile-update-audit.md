## Correction after live trigger inspection (2026-11-14)

The initial audit overstated the risk by treating column UPDATE privileges as equivalent to effective write access. **Production has a BEFORE UPDATE trigger** `prevent_user_privileged_profile_fields` which rejects non-admin, non-service-role changes to `account_type`, identity verification, coach verification, profile claims, and moderation fields; player verification requires approved owner admin. Other triggers `protect_profile_moderation_fields` and `enforce_player_profile_locks` also apply.

**Revised status:** Broad UPDATE grants are confirmed, but privilege escalation is **not established**; existing triggers appear to block it. Do not describe this as an exploitable vulnerability without a real authenticated JWT test. Column-scoped grants remain optional defense in depth and require extensive regression tests. Existing signup completion's account_type write was incompatible with the trigger when the value differed; the branch removed that write.

**Remaining validation:** Verify trigger behavior with real JWTs, including attempted privileged updates, normal settings, Google onboarding, admin verification, and service-role operations. Do not apply candidate grants until passing.

---

# Profile UPDATE privilege audit — REELS-1 prerequisite

Production read-only evidence, 2026-11-14:
- `authenticated` has table-wide UPDATE on public.profiles.
- `has_column_privilege(authenticated, profiles.account_type, UPDATE)` and identity_verification_status both return true.
- RLS own-update policy checks only id = auth.uid().
- No non-internal trigger was returned for public.profiles in the trigger query.
- The signup completion client writes account_type directly, so a blanket revoke without refactoring breaks signup.

Confirmed client update sites (search results; audit may be incomplete):
- app/signup/complete/page.tsx: account_type, basketball_type, favorite_teams, experience_goal, research_preferences
- app/onboarding/page.tsx: display_name, bio, favorite_teams, basketball_type, position, years_pro, country
- app/complete-profile/page.tsx: profile details and profile_visibility
- app/account/page.tsx: avatar_url and settings object (inspect keys)
- app/settings/page.tsx: theme_preference, preferred_language
- components/FanBasketballSideSwitch.tsx: preferred_basketball_side
- components/LanguageProvider.tsx: preferred_language
- app/onboarding/teams/page.tsx: onboarding_completed
- app/api/verification/identity/route.ts: privileged identity updates via admin client, MUST remain server-only

Security remediation sequence:
1. Inventory ALL direct profile update payloads, including dynamic objects and RPCs.
2. Move account_type changes to a constrained server onboarding endpoint with an explicit allowed-role transition table, and forbid client assignment of admin/verification roles. Do not treat account_type as a trusted admin entitlement.
3. Replace authenticated table-wide UPDATE with audited column-specific grants for benign fields only.
4. Ensure protected fields (identity_verification_status, account_type, identity session IDs, admin/verification flags) cannot be modified with authenticated JWT, including PostgREST PATCH and RPC paths.
5. Run real JWT regression tests for signup, Google onboarding, account settings, profile editor, and identity verification. Check account-role transitions do not grant admin, manager claim, or verification.
6. Only then add Creator role and follow support. Keep production untouched until passing verification.

Status: vulnerability *potential* confirmed by SQL privileges + RLS; end-to-end exploitation not tested. No fix deployed.
