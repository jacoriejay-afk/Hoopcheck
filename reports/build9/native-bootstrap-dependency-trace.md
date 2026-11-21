# Build 9 — native account bootstrap dependency trace

Reviewed PR #747 baseline `658584a9b86c4d3e6ea15a8f5c82d27aedee5a1b`. This is **not** installed Build 7 source.

## Observed flow
- `apps/mobile/src/native/useNativeAccount.ts` requires online status, `useMfaSession().phase === 'ready'`, and a session whose user ID matches the MFA owner. It calls `requestNativeAccount` and checks the returned user ID.
- `apps/mobile/src/native/accountClient.ts` sends the access token to `GET /api/mobile/bootstrap` over HTTPS, rejects non-OK responses, and validates account and entitlement response types.
- `app/api/mobile/bootstrap/route.ts` verifies the bearer token with `auth.getUser`, then queries `profiles.select('account_type,display_name,player_verified').eq('id', auth.user.id)`, `membership_entitlements`, and `get_current_user_admin_role`. It returns 503 on dependency errors, 409 for missing profile, and private/no-store responses.
- `apps/mobile/src/native/playerProfiles.ts` uses `get_public_player_profile` with `get_own_profile` fallback for self and `is_player_country_public` visibility RPC for other profiles.

## Findings
1. The bootstrap's direct profile SELECT is restricted to three **non-private-revocation** fields and a verified owner ID. The pending private-column restriction does not list those three columns.
2. The bootstrap's membership and admin-role dependencies must be tested under the global opt-in MFA hook and RLS policy changes.
3. The profile editor still performs `UPDATE profiles ... RETURNING id`; test this independently under future grants/RLS.
4. This is a sampled source trace, not a full repository-wide search, installed Build 7 verification, or runtime acceptance.

## Next acceptance checks
- Authenticated bootstrap for player/fan/admin, MFA enrolled aal1 vs aal2, expired token, missing profile, and subscription entitlement states.
- Native sign-in, app resume, account switching, and profile editor save under actual device sessions.
- Confirm that no raw protected profile-column SELECTs remain elsewhere in installed clients before revocation.

No production changes, database migrations, paid branches, merges, or EAS builds.
