# Build 9 protected integration exact-head CI gate — 2026-11-22

Status: DEVELOPMENT VERIFICATION ONLY. Source baseline `2c3b06e5409cac7edf242e4eb1477d51ff52515d` (#827 merge); release PR #755 remains DRAFT and blocked.

## Problem

At the verified #827 integration merge commit GitHub reported zero workflow runs for that exact SHA. Existing workflow event filters generally executed on PR heads, selected feature branches, or production `main`, which cannot establish a complete combined-head verdict for the protected integration branch. Historical PR-head SUCCESS is not interchangeable with post-merge combined-head SUCCESS.

## Change

The six pre-existing workflows are now eligible to run against every push to `integration/build9-backend-completion-20261121`, and all six can also be exercised on review PRs targeting that branch. The build/test commands, checkout ref, existing permissions, security/privacy/Stripe/entitlement logic, and iOS unsigned-only constraints are unchanged. Mobile and native-security feature-branch push paths are broadened to allow exact-head integration coverage. This will consume more Actions minutes on affected branches; review before merge.

Required at the resulting **exact integration SHA**, each with `conclusion: success`:
1. HoopCheck CI.
2. Mobile App Checks.
3. Unsigned iOS Native Verification (simulator, unsigned, never EAS).
4. HoopCheck Launch Test (Final Gate).
5. NATIVE-2 Security Tests.
6. VERIFY-1 entitlement matrix.

## Release HOLD remains in effect

- Production `main` moved independently after #827. Reconcile newer web My Court/Career/Settings/HoopGroups changes without overwriting security, moderation or native functionality; #755 is not mergeable against current main.
- Require an **authorized production-schema-equivalent PostgreSQL 17** migration rehearsal and rollback, including function owner/ACL/RLS diffs. The PR17 test fixture is not equivalent.
- Require genuine authenticated owner/non-owner AAL1/AAL2 signed HTTP and cross-account negative checks, direct private-column privacy remediation, and installed Build 7/8 API compatibility evidence.
- Require physical Build 9 iPhone usability/OAuth/Face ID/Passport-share and real Apple Sandbox subscription/trial/restore/cancel acceptance, authorized signing identity/counter.
- Keep seven-day free trial disabled until verified. Do not change Supabase production grants/migrations, Stripe, EAS, TestFlight/App Store, or deploy release PR #755.

A green Actions matrix proves source-level CI only; it cannot satisfy these external acceptance gates.
