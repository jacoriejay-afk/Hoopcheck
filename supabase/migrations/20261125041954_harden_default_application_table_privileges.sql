-- Applied to both projects on 2026-11-25. Do not alter managed Supabase role defaults.
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from public, anon, authenticated;
