-- HoopCheck: make the profile-level HoopFeed country visibility preference available.
-- Idempotent because this migration may follow a source-only historical migration.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_country_public boolean NOT NULL DEFAULT true;

UPDATE public.profiles
SET current_country_public = true
WHERE current_country_public IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN current_country_public SET DEFAULT true,
  ALTER COLUMN current_country_public SET NOT NULL;

-- Ensure PostgREST can see the newly added column immediately.
NOTIFY pgrst, 'reload schema';
