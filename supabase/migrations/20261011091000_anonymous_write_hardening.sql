-- Prevent anonymous writes and remove dangerous table-level privileges.
-- Row-level security does not protect against TRUNCATE, REFERENCES, or TRIGGER privileges.
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
