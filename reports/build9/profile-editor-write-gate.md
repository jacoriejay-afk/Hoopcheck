# Build 9 — profile editor write gate

Read-only isolated Supabase audit (2026-11-21):

- `authenticated` has table SELECT but **no UPDATE** on `public.profiles`.
- `has_column_privilege(authenticated, profiles.display_name, UPDATE)` = false.
- `has_column_privilege(authenticated, profiles.current_country, UPDATE)` = false.
- `has_column_privilege(authenticated, profiles.id, SELECT)` = true.
- `public.get_own_profile()` is absent.
- `public.membership_entitlements` is absent (prior audit).

Current Build 9 native `saveOwnProfile` uses `client.from('profiles').update(values).eq('id', userId).select('id')`. Therefore the isolated project **cannot pass this write path as configured**, independently of the private-column SELECT revocation. This is an isolated environment finding, not a verified production defect.

Do not blindly grant UPDATE on the test or production project: confirm column allowlist, UPDATE RLS, MFA and role constraints, and owner-scoped PostgREST behavior. Prefer reviewed least-privilege grants or an owner-only write RPC with tests. Do not weaken RLS.

## Release blockers
1. Restore isolated test schema parity and appropriate least-privilege write contract.
2. Run actual profile editor owner/non-owner, MFA AAL1/AAL2, and UPDATE RETURNING id integration tests.
3. Validate current website and Build 9 native app; Build 7 compatibility intentionally excluded.
4. Complete physical-iPhone freeze and Apple Sandbox acceptance, final CI, signing and release review.

No production modification, paid branch, merge, EAS or migration applied. Build 9 remains NO-GO.
