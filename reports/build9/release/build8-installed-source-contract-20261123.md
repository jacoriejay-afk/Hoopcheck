# Build 9 — installed Store Build 8 source-to-production contract (2026-11-23)

**Disposition: BLOCKED — real installed-client backend compatibility not met. No production changes.**

## Independently recovered exact shipped build source

Expo/EAS Store iOS build `f0dd9cd3-cee2-49a7-b541-5485144f377e`, HoopCheck `0.2.0 (8)`, marked **FINISHED** on November 19, 2026, records source SHA **`c0b77ba3e7de5beb88cd588a8cfe506bec315e2b`**. The GitHub exact Git commit **exists** and exposes complete tree `419e006bb785c7a8e3e69e0dfa2fe0ba7a6c104c` (nontruncated). This is concrete **Build 8 shipped source evidence**, not an inferred or substituted development branch. The older Store Build 7 SHA `fe9691b7d619e92370ac498169f7b36d8b64d1c2` still cannot be fetched from GitHub; its signed IPA exists in Expo but source request compatibility is unresolved.

### Actual native Build 8 calls, reviewed at exact recorded source SHA

- [Native profile editor](https://github.com/jacoriejay-afk/Hoopcheck/blob/c0b77ba3e7de5beb88cd588a8cfe506bec315e2b/apps/mobile/src/native/profileEditor.ts): `readOwnProfile(client,userId)` calls the shared `getOwnProfile(client,userId)` (uses RPC `public.get_own_profile()`) **before it can load or submit the editor**; `saveOwnProfile` sends owner-targeted `profiles.UPDATE` for a role-specific subset of 15 native editor fields, with `.select("id")`. The owner RPC is a **hard required dependency** for installed Build 8 edit screens, not an optional future Build 9 endpoint.
- [Native player detail](https://github.com/jacoriejay-afk/Hoopcheck/blob/c0b77ba3e7de5beb88cd588a8cfe506bec315e2b/apps/mobile/src/native/playerProfiles.ts): `get_public_player_profile(uuid)` for discovery; own-player fallback calls the same `getOwnProfile`; nonowner country visibility calls `is_player_country_public(uuid)`.
- [Native search](https://github.com/jacoriejay-afk/Hoopcheck/blob/c0b77ba3e7de5beb88cd588a8cfe506bec315e2b/apps/mobile/src/native/playerDirectory.ts): `search_public_players_by_username`, four arguments, including positional defaults for country/limit/offset in the installed function.
- [Native games/chat](https://github.com/jacoriejay-afk/Hoopcheck/blob/c0b77ba3e7de5beb88cd588a8cfe506bec315e2b/apps/mobile/src/native/liveGames.ts): reads `fan_live_games` and `fan_live_chat_messages`, checks `fan_live_chat_room_open(uuid)`, and writes user-bound presence/messages. Direct owner read/write of `profiles.preferred_basketball_side` is a further legacy call that must remain supported.

## Executed exact committed read-only SQL on production

The exact fetched Git blob **`b03d39a2a2597c51a2c544d845e47e3245b5efa0`** of [`supabase/tests/build8_installed_store_contract_readonly.sql`](../../../supabase/tests/build8_installed_store_contract_readonly.sql) ran unchanged in a `BEGIN TRANSACTION READ ONLY` on production project `ucbdceaieyenljcwlhnj`. It queries only system catalogs and ACLs, returns metadata and rolls back. **No customer rows, JWTs, SQL DDL/DML, permissions or billing were changed.**

| Installed Build 8 dependency | Production catalog result |
| --- | --- |
| `public.get_own_profile()` | **MISSING — hard compatibility blocker for installed Build 8 editor** |
| `public.get_public_player_profile(uuid)` | present, anon/auth EXECUTE |
| `public.search_public_players_by_username(text,text,integer,integer)` | present, 3 optional args, anon/auth EXECUTE |
| `public.is_player_country_public(uuid)` | present, anon/auth EXECUTE |
| `public.fan_live_chat_room_open(uuid)` | present, authenticated EXECUTE; anon denied |
| 15 explicit native editor UPDATE columns | all exist; authenticated effective UPDATE true, anon UPDATE false |
| `public.profiles` RLS | enabled |
| Raw `public.profiles.current_country` SELECT | **still allowed for both anon and authenticated** — separate privacy risk for phase-2 |

System catalogs verify function presence and privilege shape **only**; they do not verify authenticated user RLS evaluation, triggers, private data filtering, signed requests, installed device behavior or editor writes. The missing owner RPC is independently enough to withhold the release. The presence of 15 UPDATE grants does **not** cure an editor that fails at its initial RPC.

## Safe ordered production handoff

1. An authorized database operator obtains a **private, schema/roles-only PG17 production-equivalent rehearsal**. The PR17-Test fixture has different function ownership, lacks essential historical functions and tables, and must **not** be used as proof of production compatibility. Never copy personal or payment data into a repository.
2. Review the existing **unapplied owner-profile boundary migration** `supabase/migrations/20261119074537_profile_private_field_boundary.sql` and its MFA prerequisite/privileged helper owner, source fingerprints, ACL/RLS, exact dependencies and rollback. Do not apply a PR17 protected-reader owner reconciliation to production's differently owned `get_public_player_profile(uuid)`. Do not simply grant global `SELECT` or force function ownership to make an app test green.
3. **Add the compatible `get_own_profile()` server contract before restricting any direct profile columns**, then verify actual signed AAL1/AAL2, owner/nonowner, account switching and all 15 edit/write fields; use negative permission and privacy tests. Preserve Store Build 8's read endpoint, response shape and `UPDATE RETURNING id` behavior.
4. Test installed Build 8 and Build 7 on real devices, including startup, user profile editor, public/private players, country opt-out, Live Games and chats. Test Build 9's physical iPhone UX and Apple Sandbox purchase/restore/monthly 7-day trial/renew/cancel/refund. Do not infer such results from GitHub CI or an unsigned simulator.
5. Only after separate approvals and complete evidence can the production private-column restriction and Build 9 release be reviewed. Keep postgame chat server flag OFF.

**PR #755 must remain DRAFT/HOLD.** Do not change production roles, Auth, SQL, Stripe, EAS/TestFlight or live Vercel to bypass these gates.
