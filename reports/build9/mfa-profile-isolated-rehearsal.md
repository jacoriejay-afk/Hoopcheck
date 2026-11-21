# Build 9 — isolated MFA/profile rollout rehearsal (NO-GO until gates pass)

Scope: isolated Supabase project `vcprqpjkyubzzcjatdpx` only. **Never apply these steps to production by implication.** The source candidate migrations in PR #747 are unchanged.

## Verified starting point (2026-11-21)
- `public.get_public_player_profile(uuid)` exists with a restricted definer owner, but its isolated implementation lacks integrated MFA and owner-visible private-country logic.
- `hoopcheck_security.mfa_satisfied()`, `hoopcheck_security.player_profile(uuid)`, restrictive MFA policies, and the PostgREST MFA pre-request hook are absent.
- 33 RLS-enabled tables are in scope for the opt-in MFA migration's policy loop (including selected storage/realtime surfaces).
- Existing authenticator role configuration contains no `pgrst.db_pre_request` hook; verify database-scoped role settings separately before any rollout.
- Rollback-only experiments confirmed: `aal1` + verified factor yields zero profile rows; `aal2` + verified factor returns one row and preserves owner's private country. No fixture or helper persisted.

## Safe staged order
1. Capture isolated project schema-only snapshot, ACL/RLS policy inventory, role/database-scoped pre-request settings, migration ledger, function definitions, and restore procedure. Verify that restore is executable **before** global hook/policy changes.
2. Rehearse the **unchanged** `20261118162456_opted_in_mfa_enforcement.sql` on a disposable clone of the isolated project. It creates `mfa_satisfied()`, adds restrictive policies to all qualifying RLS tables, and configures the authenticator hook. This is **not** a profile-only change.
3. Validate baseline `aal1` with no verified factor, enrolled `aal1` denial, enrolled `aal2` access, anonymous public access, storage/realtime access, and representative subscriptions and team/group flows. Use rollback-only fixtures.
4. Rehearse **unchanged** `20261119074537_profile_private_field_boundary.sql` after its prerequisite migrations. Validate the owner/private-country and player-only/hidden/suspended matrices; verify `public.get_public_player_profile(uuid)` delegates to the canonical security-definer boundary.
5. Keep `20261119075626_restrict_private_profile_columns.sql` **unapplied** until exact installed Build 7 raw-column SELECT compatibility is demonstrated and an owner-approved rollout path exists.
6. Compare role/ACL/policy inventories before and after. Only then consider a separate additive migration for any verified contract gap; do not rewrite the existing migration hashes.

## Stop conditions
- Missing verified backup/restore, conflicting pre-request hook, failed auth/Storage/Realtime tests, unexpected role privilege expansion, missing real-client compatibility evidence, or any failure to restore the isolated clone.
- Do not merge, deploy, start EAS, or touch production while a stop condition remains.

## Rollback
For SQL fixture tests: `ROLLBACK` and recheck helper/fixture absence.
For a full rehearsal on a disposable clone: restore the **verified pre-rehearsal snapshot**; do not assume `DROP FUNCTION` or `DROP POLICY` alone reverses the migration. The MFA migration modifies policies across many tables and an authenticator role setting; all must be restored and checked against the captured inventory.
For a deployed global hook, removal must also restore the previous exact role/database-level hook setting and reload PostgREST configuration. **Do not execute this production procedure without explicit approval.**

## Acceptance
All staged contract and real-client tests pass, schema/privilege diffs are reviewed, and exact Build 7 compatibility is documented. Until then: **Build 9 NO-GO**.
