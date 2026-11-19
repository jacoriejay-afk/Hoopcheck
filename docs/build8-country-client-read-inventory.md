# Build 8: direct country reads in web and native clients

Read-only GitHub default-branch code search for `current_country` (2026-11-19) confirms additional **client compatibility and privacy exposure** beyond the SQL functions. This inventory is incomplete until all branches and call paths are checked.

| Client surface | Direct profiles read | Required remediation |
| --- | --- | --- |
| `app/players/page.tsx` | Public player directory selects `current_country` from `profiles` | Replace with masked directory RPC; ensure private country is not searchable or filterable |
| `apps/mobile/app/players.tsx` | Native player directory selects `current_country` from `profiles` on default branch | Confirm Build 8 replacement in `apps/mobile/src/native/playerDirectory.ts` and eliminate all remaining direct directory reads |
| `app/profile/page.tsx` | Owner profile reads `current_country` directly | Owner-only secure read RPC or equivalent; preserve HoopPassport and completion state |
| `app/complete-profile/page.tsx` | Owner onboarding reads `current_country` directly | Preserve owner-only edit and completion state |
| `components/PlayerProfileCompletionCard.tsx` | Owner completion card reads `current_country` directly, including post-update select | Preserve both initial and update-return projections |
| `app/account/page.tsx` | Account editing has `current_country` and privacy setting | Audit actual query and update paths |
| `app/admin/users/page.tsx` | Admin UI reads country via admin RPC and edits via `admin_update_profile` | Preserve authorized admin functions; avoid granting broad raw country reads |

## Release gate

Do **not** revoke raw country SELECT until every relevant web/native read has been migrated and tested; otherwise these surfaces will break. Do **not** keep direct SELECT open for public directories; that preserves the leak. Reconcile the main branch against #733 and #736 before migration, then test anonymous, authenticated owner, other user, and admin permissions in isolated PostgreSQL and UI tests. No production database changes are authorized.

## Build 8 branch reconciliation (verified from PR #739 branch)

The default-branch search results above **do not describe the current Build 8 implementation**. Fetching the actual branch files confirms:

- `app/players/page.tsx` **already calls** `supabase.rpc("search_public_players", {p_username,p_country,p_limit,p_offset})`, not a direct `profiles.current_country` directory read.
- `apps/mobile/app/players.tsx` **already delegates** to `readPlayerDirectory` from `apps/mobile/src/native/playerDirectory.ts`.
- That native helper **already calls** the new four-argument `search_public_players` RPC and maps its returned `current_country` projection. It does not directly select the raw column.

**Consequences:** Do not rewrite these two directories based on stale default-branch search snippets. Their remaining release gate is deployment of the matching masked RPC migration and tests that private country cannot be inferred via output, search, filters, or pagination. The other owner-editing direct reads above still require compatibility review. This supersedes the table's default-branch statements for these two directories.
