# Build 9 — private-column restriction rollback smoke test

Scope: existing isolated Supabase test project only. No Build 7 compatibility gate; current website/native compatibility remains required.

## Executed rollback-only SQL
```sql
BEGIN;
REVOKE SELECT ON public.profiles FROM authenticated;
REVOKE SELECT (current_country,moderation_note,agreed_to_terms) ON public.profiles FROM authenticated;
GRANT SELECT (id,account_type,display_name,player_verified) ON public.profiles TO authenticated;
SELECT
 has_column_privilege('authenticated','public.profiles','current_country','SELECT') AS private_country,
 has_column_privilege('authenticated','public.profiles','moderation_note','SELECT') AS moderation_note,
 has_column_privilege('authenticated','public.profiles','account_type','SELECT') AS account_type,
 has_column_privilege('authenticated','public.profiles','display_name','SELECT') AS display_name,
 has_column_privilege('authenticated','public.profiles','player_verified','SELECT') AS player_verified;
ROLLBACK;
```

## Results
- Private country = false (PASS)
- Moderation note = false (PASS)
- Account type = true (PASS)
- Display name = true (PASS)
- Player verified = true (PASS)
- Post-rollback country and moderation grants restored = true (PASS)

This is a **limited grant smoke test**, not execution of `20261119075626_restrict_private_profile_columns.sql`, nor a complete privilege/RLS/MFA test. It does not prove profile editor UPDATE compatibility, backend membership availability, or website/client compatibility.

## Next gates
- Rehearse the **exact** migration with a guaranteed rollback, check every protected field, and test editor UPDATE RETURNING id.
- Validate existing website and Build 9 native query contracts.
- Restore isolated environment parity for membership_entitlements and get_own_profile before end-to-end bootstrap tests.
- Keep production untouched pending explicit approval and verification.
