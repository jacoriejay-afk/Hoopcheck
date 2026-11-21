# Build 9 — rollback-only profile editor write grant rehearsal

Isolated Supabase project, 2026-11-21.

Executed within `BEGIN`/`ROLLBACK`:
```sql
GRANT UPDATE (display_name,current_country) ON public.profiles TO authenticated;
SELECT
 has_column_privilege('authenticated','public.profiles','display_name','UPDATE'),
 has_column_privilege('authenticated','public.profiles','current_country','UPDATE'),
 has_column_privilege('authenticated','public.profiles','id','SELECT'),
 has_column_privilege('authenticated','public.profiles','moderation_note','UPDATE');
```
Results: `true,true,true,false` (PASS for narrow permission assertions). Follow-up after rollback: `display_name` and `current_country` UPDATE both `false`, confirming no persistent grant.

**Important:** This does not establish an authorized owner-scoped UPDATE. Existing RLS and grants must be tested with real authenticated claims and MFA; verify the full native editor's editable-column allowlist, owner/non-owner behavior, and `UPDATE ... RETURNING id` before proposing a migration. Avoid broad UPDATE grants.

Other isolated schema blockers remain: missing `get_own_profile()` and `membership_entitlements`. No production changes, merge, EAS, or paid infrastructure.
