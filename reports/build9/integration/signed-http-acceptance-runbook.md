# Build 9 — real signed HTTP acceptance (isolated PR17 test only)

**Status: prepared, NOT executed against signed real-user sessions.** This is a gated test runner, not authorization to modify any database. The fixture-based PostgreSQL role tests already in this PR remain separate; their synthetic JWT claims do not prove actual authenticated HTTP behavior.

Runner: `node scripts/build9-signed-http-acceptance.mjs`

## Prerequisites

1. The Supabase project must be **HoopCheck-PR17-Test** (`vcprqpjkyubzzcjatdpx`), never production `ucbdceaieyenljcwlhnj`. The runner hard-pins the exact HTTPS hostname and rejects alternate hosts, paths, usernames, URL query strings and redirects.
2. An **existing authorized owner-capable runner** must first reconcile protected `public.get_public_player_profile(uuid)` while preserving its owner `hoopcheck_public_profile_reader`, OID, ACL, empty search_path, moderation and country consent rules. The available `postgres` executor cannot SET or USE that owner. Do **not** elevate role membership, force ownership, relax RLS, bypass moderation or replay unrelated historical migrations.
3. Separately review/apply canonical follow graph, block policies, profile-owner and MFA prerequisites **only on the isolated test project** with a transaction/rollback rehearsal and a reviewed persistent migration plan. Record before/after SQL catalogs and migration history.
4. Obtain **real Auth-issued sessions** for disposable test users: one enrolled owner with both an AAL1 token *and* a verified TOTP AAL2 token for the **same user**, plus an unrelated authenticated user. Create/choose three real seeded player profiles: public, private, and a public player with non-null `current_country` and `current_country_public=false`. A different authorized test account can observe privacy protections without assuming owner permissions.

## Environment inputs (never commit, paste into chat, or log token values)

- `BUILD9_ACCEPTANCE_URL` = `https://vcprqpjkyubzzcjatdpx.supabase.co`
- `BUILD9_ACCEPTANCE_ANON_KEY` = test project's publishable/anon API key
- `BUILD9_ACCEPTANCE_OWNER_AAL1_TOKEN` = real Auth access token before TOTP verification
- `BUILD9_ACCEPTANCE_OWNER_AAL2_TOKEN` = real Auth access token after TOTP verification
- `BUILD9_ACCEPTANCE_NONOWNER_TOKEN` = another real Auth user's access token
- `BUILD9_ACCEPTANCE_PUBLIC_PLAYER_ID` = seeded visible player
- `BUILD9_ACCEPTANCE_PRIVATE_PLAYER_ID` = seeded private player
- `BUILD9_ACCEPTANCE_OPTOUT_PLAYER_ID` = seeded public opt-out player

Run locally on an authorized machine after `node scripts/build9-signed-http-acceptance.mjs --self-test`. Supply secrets through an ephemeral process environment rather than shell history or CI logs, with shell tracing disabled. The runner verifies token/user alignment by contacting `/auth/v1/user`—it does not trust locally decoded JWT claims as signature proof—and then uses read-only allowlisted PostgREST queries / vetted STABLE RPCs. No DDL, DML, billing operation, log of response bodies, token minting or hosted deployment is performed. No external HTTP redirects are permitted.

## Pass criteria

- Auth verifies both owner AAL1 and AAL2 sessions, plus a distinct unrelated user.
- Anonymous and unrelated users get explicit permission denial for raw private country and moderation columns (an empty 200 response is **not** an ACL pass).
- The known public player is visible to an anonymous caller; a known private player is absent for the unrelated caller.
- A publicly visible country-opt-out player has `current_country=null` in scoped detail.
- The enrolled owner's AAL1 session is explicitly denied the protected owner RPC, while the verified AAL2 session receives only the owner's JSON object.
- Public follower discovery RPC exists and responds with a JSON array.

A failed or unavailable prerequisite is a **release HOLD**, not a reason to broaden privileges or substitute synthetic credentials. These tests are intentionally non-mutating and do not establish write-policy/editor, block-edge fixture, or installed Build 7 backwards-compatibility acceptance. Those need additional authorized isolated tests. Keep physical-iPhone, StoreKit/Apple Sandbox, OAuth/Face ID, signed bundle identity, build-counter and freeze reproduction as independent release gates.

Review evidence on [PR #757](https://github.com/jacoriejay-afk/Hoopcheck/pull/757). A green runner can be attached as **redacted pass/fail lines only**, with exact project reference and Git commit hash; never attach real JWTs, keys, profiles or unredacted API responses.
