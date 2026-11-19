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
