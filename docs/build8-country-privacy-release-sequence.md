# Build 8 country privacy: deployment gate and rollback

Status: **draft plan, not authorization to deploy**. PR #739 has an owner-only RPC and migrated owner-facing website reads, but the raw country column remains exposed in production until a separate, verified privilege change. Never merge or apply these migrations independently of the dependency audit.

## Required ordering

1. Reconcile stacked PRs #733, #736, and #739 against the intended release commit. Verify the deployed `search_public_players` signature matches both web and native callers. Review all nine cataloged functions in `docs/build8-country-function-dependencies.md`, especially invoker `can_view_player_feed_post`, `get_public_player_profile`, and legacy search functions. Inspect views, triggers, grants, and role inheritance too.
2. In **isolated disposable PostgreSQL**, run the security boundary tests and real client browser suites. Confirm owner edits, post-save reads, profile completion, public publishing, account switching, anonymous reads, another user's reads, authorized admin behavior, and feed access. CI fixtures do not establish production behavior.
3. With explicit approval, deploy the **additive** `get_my_private_country()` function before shipping clients that call it. Verify authenticated owner returns their country, anonymous EXECUTE is denied, and a missing JWT returns NULL. Keep the existing country SELECT grants during this compatibility stage; **privacy leak is still open**.
4. Deploy compatible web/native readers and verify all four website owner flows plus both directory clients. Any un-updated client or invoker function is a blocker for the next stage.
5. Only after all dependencies have secure alternatives and the owner approves, apply a **separately reviewed restrictive migration** that removes raw country SELECT from client roles. Review table-level SELECT grants, column-level grants, PUBLIC inheritance, views, RPC EXECUTE privileges, and feed authorization side channels. Do not assume `REVOKE SELECT(current_country)` is sufficient if a table-level SELECT grant remains.
6. Verify direct PostgREST `profiles?select=current_country` is denied for anon and authenticated (including the profile owner), while authorized owner RPC, safe UPDATE ... RETURNING, masked public directory, admin workflow, and player feed all continue to work. Document evidence before declaring the leak closed.

## Latest automated verification

GitHub Actions run [44506264578](https://github.com/jacoriejay-afk/Hoopcheck/actions/runs/44506264578) completed successfully at commit `2546f89990269e4c3af8f03f7cd13da7e7cd23eb`. This covers the current draft branch's CI checks, including isolated SQL and browser profile-completion tests. It does **not** verify actual production privileges or the full feed/admin compatibility matrix.

## Failure / rollback

If an additive RPC rollout fails, restore the prior web client before removing the RPC. If the restrictive rollout breaks owner flows, feed visibility, or admin operations, pause the rollout and restore the prior verified access policy **only through an approved migration**, noting that restoring raw SELECT reopens the privacy leak. Do not claim privacy is fixed until direct reads are denied and compatibility is verified.

## Release constraints

Do not apply to production or the isolated shared Supabase project without owner approval. Do not merge PRs or start EAS. No credentials or personal country values belong in test logs.
