# Build 9 — exact private-profile restriction SQL rollback rehearsal

Source: `supabase/migrations/20261119075626_restrict_private_profile_columns.sql` at PR #747 baseline `658584a9`.

Executed on isolated test project in a single `BEGIN`/`ROLLBACK` transaction. The original SQL's `NOTIFY pgrst,'reload schema'` was omitted to avoid an unnecessary notification. All permission-changing SQL was executed unchanged.

## Assertions inside transaction
- Protected profile columns present: **16**
- Protected columns still SELECT-readable by `authenticated`: **0** (PASS)
- `account_type`, `display_name`, `player_verified` still SELECT-readable by `authenticated`: **true/true/true** (PASS)

## Post-rollback
- Protected columns SELECT-readable again: **16/16** (PASS). No persistent permission change.

## Boundaries
This tests grants, not full PostgREST API behavior, MFA enforcement, RLS, UPDATE RETURNING, website usage, or native device behavior. The isolated project still lacks `membership_entitlements` and `get_own_profile()`. Build 7 backward compatibility is explicitly out of scope by owner direction, but currently deployed website and Build 9 contracts still require verification.

No production changes, merge, EAS build, or paid infrastructure.
