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

## Owner profile/edit compatibility audit (Build 8 branch, 2026-11-19)

Direct `profiles.current_country` SELECT is still required by **four owner-facing website surfaces**:

- `app/profile/page.tsx`: profile fetch includes country; the page renders it in HoopPassport and the location row. Verify whether this page is strictly self-only; otherwise a country display must honor `current_country_public`.
- `app/complete-profile/page.tsx`: initial owner read (line 59), post-save UPDATE ... SELECT (line 114), and profile-visibility UPDATE ... SELECT (line 136). Both returning projections include `current_country`.
- `components/PlayerProfileCompletionCard.tsx`: owner read (line 16) and UPDATE ... SELECT (line 46) include country.
- `app/account/page.tsx`: owner account read includes `current_country` and `current_country_public` (line 153), and update payload writes both (lines 275/284). Inspect the save response projection before altering grants.

**Critical release dependency:** A blanket `REVOKE SELECT(current_country)` for `authenticated` will cause these owner queries and update-returning queries to fail, even if RLS allows the owner's row. A secure owner-only country reader RPC must be introduced *and* all these clients migrated, with post-update reads split from UPDATE projections or changed to use a protected owner reader. Verify full update/write privileges and admin RPCs independently. Never expose the raw column via a public view or a SECURITY DEFINER RPC without owner identity checks.

The isolated authorization test passing is necessary but not sufficient: it does not test these real Next.js client flows. No production schema modification or rollout is approved.
