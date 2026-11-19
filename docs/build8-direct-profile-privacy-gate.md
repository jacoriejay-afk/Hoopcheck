# Build 8: direct profile country privacy — security design gate

Tracking: #737. Base: #736 (privacy-aware RPCs). **Audit-only; no production migration in this branch.**

## Confirmed production behavior from read-only catalog inspection

- `public.profiles` has row-level security enabled.
- `profiles_public_read` permits anonymous SELECT of rows with `profile_visibility='public'`.
- `profiles_authenticated_read` permits authenticated SELECT of public rows, their own row, or admin/moderator rows.
- Both `anon` and `authenticated` have **column-level** SELECT permission on `current_country` and `current_country_public`, despite lacking table-wide SELECT permission.
- Therefore a public profile with `current_country_public=false` is not protected from a direct `profiles.select('current_country')` request by the existing row policy. The query-level exposure is a permission consequence; no personal location values were read to establish it.
- The privacy-aware RPCs in #736 do not revoke these direct table permissions.

## Existing client contracts that must survive a database fix

- `apps/mobile/src/native/playerDirectory.ts` uses `search_public_players(p_username,p_country,p_limit,p_offset)`.
- `apps/mobile/src/native/playerProfiles.ts` uses `get_public_player_profile(p_user_id)`; its direct `profiles` read is restricted in client code to the signed-in player's own profile.
- Web `app/profile/page.tsx`, `app/account/page.tsx`, `app/complete-profile/page.tsx`, and `components/PlayerProfileCompletionCard.tsx` read `current_country` for own-account features.
- Other web/mobile clients read `profiles` for onboarding, authorization, directory, and account UI. Broadly revoking SELECT or changing RLS may break those consumers.

## Security boundary design constraints

Postgres RLS filters **rows**, not individual column values based on row predicates. A public SELECT grant on `current_country` cannot be made safe by a UI mask, RPC mask, or RLS condition that still allows reading the public row.

A production fix must choose and test an enforceable storage/API boundary. Candidate: keep private `current_country` in a dedicated owner-readable table (with strict RLS, controlled writes, backfill, and admin/service access), while exposing only explicitly public country in the public profile projection. This is a **candidate architecture, not an approved migration**. An alternative is a private value plus separately maintained public projection, with direct raw-column grants revoked and compatible owner-only read/write RPCs.

## Required isolated acceptance tests before migration

1. Synthetic `anon`, player owner, another player, fan, coach, and service/admin roles with production-equivalent column grants and RLS.
2. Public row with `current_country_public=false`: non-owner direct table query must not reveal country; country-based search must not match it.
3. Public row with `current_country_public=true`: approved public country appears in both web/native directories and public player details.
4. Private or players-only rows, suspended rows, and rejected avatars retain existing visibility/moderation rules.
5. Owner can view, edit, and toggle country visibility; switching public to private removes public exposure without stale projections.
6. Existing `search_public_players` overloads, `search_public_players_page`, `get_public_player_profile`, `is_player_country_public`, own-profile editing, onboarding, account, and team/feed clients remain compatible.
7. PostgreSQL migrations rehearse against production-equivalent and isolated test schemas, including rollback/backfill and dependency inspection.
8. No direct production changes, PR merge, OTA or EAS build until explicitly authorized.

## Release decision

#736 CI passed for RPC privacy. **Do not interpret that as proof of direct-table privacy.** #737 remains an independent release blocker. This branch documents the boundary and tests; it intentionally does not apply a risky grant/schema change.
