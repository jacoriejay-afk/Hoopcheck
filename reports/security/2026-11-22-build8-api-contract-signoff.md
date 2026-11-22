# HoopCheck Build 8 / Backend Security — Sign-off Evidence
Date: 2026-11-22. This records **verified release gates, not a full Build 9 approval**.

## Released and verified
| Scope | Decision | Evidence |
|---|---|---|
| Production website | GO for currently deployed website | Prior full CI/Launch/entitlements; Vercel live domain deployment checked |
| Legacy player directory privacy masking | GO Phase 1 | #789, production migration 20261122032844, 3 installed legacy functions masked private country and pending avatars, anonymous read-only smoke |
| Public Build 8 discovery/consent compatibility | GO additive read-only RPC repair | #802 merge 301b71829178a1b070c0452e8057d15b9632c4a6; production migration **20261122040018**; read-only preflight, PostgreSQL 17.11 synthetic role/RLS rehearsal, exact source CI PostgreSQL fixture, launch and preview checks, owner/security/grant postchecks, anon-role smoke |
| Development dependencies | GO | #790 with zero production-only and full developer dependency advisories after patched lockfile |

The two newly installed RPCs preserve Build 8's exact argument names, types, defaults and outputs: `search_public_players_by_username(text,text,integer,integer)` and `is_player_country_public(uuid)`. Both are SECURITY INVOKER, STABLE, owned by postgres, use search_path public, and EXECUTE is granted to anon/authenticated but **not unrestricted PUBLIC**. They keep RLS and the current table grants unchanged. No customer data modification, billing change, restricted-owner privileges, EAS build, or Apple submission was performed.

**Verified source fingerprints:** `search_public_players_by_username` = `5970446048bb69b39ebf46c911bea8ac`; `is_player_country_public` = `1040aa769cb9e51a51c40b5bdd14ee6b`. Production has 200 recorded migrations at verification. Archive file is a verbatim copy of the applied reviewed candidate.

## Real Build 8 archive
Expo EAS lists completed iOS Store-distribution build **0.2.0 (8)**, ID `f0dd9cd3-cee2-49a7-b541-5485144f377e`, SHA `c0b77ba3e7de5beb88cd588a8cfe506bec315e2b`. This records an EAS **build**, not proof that Apple/TestFlight accepted it or a physical iPhone test passed. Actual source under `apps/mobile/src/native/` includes the two installed public RPCs **plus `get_own_profile()`**, which remains absent in production. Build 7 archive source SHA `fe9691b7d619e92370ac498169f7b36d8b64d1c2` cannot be recovered from current GitHub checkout, so its exact installed-client contract remains unknown.

## NO-GO: further backend privacy lockdown / Build 9 iOS acceptance
- `public.get_own_profile()` protected owner/MFA projection is still absent. The available helper in Build 8 calls it for authenticated owner/profile editing. Do NOT substitute a privileged SECURITY DEFINER helper without genuine owner/non-owner AAL1/AAL2 signed HTTP tests and appropriate scoped ownership.
- `public.profiles.current_country` remains directly SELECT-able by `anon` and `authenticated`; the public RPC masks do not make direct raw-column access private. Block phase-2 REVOKE pending installed Build 7/8 behavior and protected owner RPC.
- Production-equivalent schema/roles-only PostgreSQL 17 rehearsal (post-200-migration baseline), real signed API acceptance, full legacy Build7 requests, physical iPhone freeze/scroll/OAuth/Face ID and Apple Sandbox subscription lifecycle are missing. PR #755 remains draft/HOLD.
- 4 anonymous and 36 signed-in callable SECURITY DEFINER advisor warnings require per-function review (some intended), while 15 RLS policyless public tables are deny-by-default (no anon/auth direct SELECT/INSERT). Supabase leaked-password protection remains disabled, requiring eligible Auth setting action.

## Release-owner decision
**Website & the two read-only public compatibility functions: SIGNED OFF ON VERIFIED TECHNICAL GATES.**  
**Complete backend security, protected profile access and Build 9 TestFlight: NO-GO.**

No one should interpret this limited sign-off as full production privacy or Apple acceptance. Review exact installed production catalog before any further SQL, and never publish tokens, customer rows or database connection credentials as evidence.
