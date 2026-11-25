-- Applied to production and isolated test on 2026-11-25. Keep all normal DML and existing RLS policies unchanged.
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
