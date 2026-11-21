# Build 9 — no-cost profile compatibility gate

Reviewed source: PR #747, `20261119074537_profile_private_field_boundary.sql`, at `658584a9`.
Read-only isolated database audit: `public.profiles` has RLS enabled and 3 policies. `authenticated` has direct SELECT privileges on `current_country`, `moderation_note`, and `agreed_to_terms`. This is a **privilege finding**, not proof that arbitrary other users' rows can be read after RLS.

## Existing replacement contracts
- `public.get_own_profile()` is an authenticated wrapper around `hoopcheck_security.own_profile()`; its explicit projection includes private country, moderation notes, and terms acceptance. It rejects missing identity and unsatisfied MFA.
- `hoopcheck_security.player_profile(uuid)` projects a player profile; private country is visible to the owner or if explicitly public, subject to the MFA and visibility checks.
- `20261119075626_restrict_private_profile_columns.sql` is explicitly **unapplied** until installed-client compatibility is established.

## Release-blocking evidence still needed
1. Recover the exact installed Build 7 source SHA, source map, or captured API requests. The EAS-recorded SHA is unavailable from GitHub; do not substitute Build 8/9 code as evidence.
2. Record each Build 7 direct `profiles` SELECT (including columns, filters, JWT role, and call path) and match it to a compatible API. Check startup, profile, account/settings, onboarding, and sign-out.
3. Verify `get_own_profile()` and public player-profile RPC results for authorized and unauthorized users, with opt-in MFA AAL1/AAL2 and visibility cases.
4. Only then rehearse private-column revocation on a restorable disposable database and physical iPhone. No branch purchase authorized; do not apply this migration to the current isolated test project.
5. Verify installed-client behavior and explicitly approve rollout before production restrictions.

## Stop rule
No production revocation, migration, EAS, merge, or release while installed Build 7 compatibility is unverified. This report does not claim the original Build 7 source has been recovered.
