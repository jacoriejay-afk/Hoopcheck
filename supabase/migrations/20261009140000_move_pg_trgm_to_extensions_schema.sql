-- Move pg_trgm out of the exposed public schema.
-- Existing trigram indexes retain their operator-class dependencies.
-- The extensions schema already exists and anon/authenticated have USAGE on it.
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
