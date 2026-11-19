## Production read-only function dependency inventory (2026-11-19)

Catalog query: `pg_proc` + `pg_get_functiondef`, filtered to public/private SQL functions containing `current_country` (no row values read). **Ten production functions** matched:

| Function | Security definer | Compatibility concern |
| --- | --- | --- |
| `public.admin_list_users` | yes | Admin read projections |
| `public.admin_review_coach_team_request` | yes | Admin request workflow |
| `public.admin_update_profile` | yes | Authorized profile writes |
| `public.can_view_player_feed_post` | no | Feed visibility |
| `public.enforce_private_nonplayer_profiles` | yes | Trigger enforcement |
| `public.get_public_player_profile` | no | Public/owner profile projection |
| `public.get_social_suggestions` | yes | Social suggestions |
| `public.search_public_players(text,text,text,boolean,integer)` | no | Legacy directory |
| `public.search_public_players_page(text,text,text,boolean,integer,integer)` | no | Web directory |

**Correction:** This catalog query returned nine functions, not ten; the inventory is nine. The query is a text-based discovery aid, not proof that every function semantically depends on the country column. Before changing grants, inspect definitions and actual column references, views, triggers, and app queries. In particular, the invoker search/profile functions in #736 require a secure replacement read path if direct `current_country` SELECT is revoked. Never convert all functions wholesale to SECURITY DEFINER.

## Verified production function definitions (read-only, 2026-11-19)

Rechecked production `pg_get_functiondef` without reading profile rows or modifying the database:

- `can_view_player_feed_post(uuid)` is **SECURITY INVOKER** and directly compares `viewer.current_country` with `author.current_country`. Removing authenticated column SELECT before replacing this internal predicate will break player-to-player feed authorization.
- `get_public_player_profile(uuid)` is **SECURITY INVOKER** and directly projects `p.current_country` without checking `current_country_public`. Its returned country needs masking, and its SQL requires a compatible protected read path after revocation.
- Legacy `search_public_players(text,text,text,boolean,integer)` and `search_public_players_page(text,text,text,boolean,integer,integer)` are **SECURITY INVOKER**; both project raw `current_country` and use it for search and filtering even when private. Revoke legacy RPC access or replace these definitions with privacy-safe equivalents; merely deploying the newer four-argument directory RPC does not eliminate these older endpoints.
- `get_social_suggestions()` is **SECURITY DEFINER** and formats `coalesce(candidate.current_team, candidate.current_country, candidate.country, 'Player')` into `detail` without honoring the privacy flag. This can leak a private country despite column revocation. Mask the country in this privileged function before restrictive rollout.
- `admin_list_users` and `admin_update_profile` are SECURITY DEFINER with admin/moderator checks. Preserve their authorized workflows while checking EXECUTE grants and role authorization independently.

**Decision:** Do not apply a column-revocation migration yet. A safe rollout must first close the legacy RPC and social-suggestion disclosures, preserve the feed country-match authorization internally, and verify the public-profile masking and authorized admin flows. This audit did not modify production.
