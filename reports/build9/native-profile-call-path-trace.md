# Build 9 — native profile call-path trace (source review)

Source ref: PR #747 baseline `658584a9b86c4d3e6ea15a8f5c82d27aedee5a1b`. This is **not** the installed Build 7 SHA.

| Native entry | Observed call path | Contract | Finding |
| --- | --- | --- | --- |
| `apps/mobile/app/account.tsx` | `useNativeAccount()` | inspect hook implementation before claiming coverage | indirect; not yet fully traced |
| `apps/mobile/app/account/edit.tsx` | `readOwnProfile()` -> `lib/auth/own-profile.ts` -> `rpc('get_own_profile')` | JWT owner and session-stability checks | modern RPC read present |
| `apps/mobile/src/native/profileEditor.ts` | `saveOwnProfile()` -> `client.from('profiles').update(values).eq('id', userId).select('id')` | owner-scoped write, returns ID | direct table write; validate RLS/write grants separately |
| `apps/mobile/app/players/[id].tsx` | `readPlayerProfile()` -> `rpc('get_public_player_profile')` | public player projection | modern RPC read present |
| `apps/mobile/src/native/playerProfiles.ts` | `rpc('is_player_country_public')` fallback | public country visibility | verify RPC semantics and MFA behavior |

The shared `getOwnProfile` helper freezes the access token, checks the caller ID before/after RPC, and rejects a switched session. The profile editor separately validates role, owner ID, and allowed editable fields.

## Remaining checks
1. Trace `apps/mobile/src/native/useNativeAccount.ts` and any bootstrap dependency it calls.
2. Search the **entire** mobile source for raw `profiles` SELECTs, including indirect shared libraries and embedded web views. This sampled trace is not a repository-wide proof.
3. Test `UPDATE ... RETURNING id` under future column-level SELECT revocations and RLS, and validate MFA-enrolled user behavior.
4. Recover exact installed Build 7 queries or physical-device network evidence before any restrictive migration.
5. Keep production restrictions unapplied until owner-approved compatibility and rollback gates pass.

No migration, database modification, build, merge, or paid infrastructure authorized by this trace.
