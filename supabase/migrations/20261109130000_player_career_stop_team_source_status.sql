-- Preserve career stop directory identity and current/former status.
-- Career stops are self-reported and do not establish review eligibility.
ALTER TABLE public.player_career_stops
  ADD COLUMN IF NOT EXISTS womens_team_id uuid REFERENCES public.womens_teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS team_source text NOT NULL DEFAULT 'teams',
  ADD COLUMN IF NOT EXISTS career_status text NOT NULL DEFAULT 'former';

ALTER TABLE public.player_career_stops
  DROP CONSTRAINT IF EXISTS player_career_stops_team_source_check;
ALTER TABLE public.player_career_stops
  ADD CONSTRAINT player_career_stops_team_source_check CHECK (team_source IN ('teams', 'womens_teams'));
ALTER TABLE public.player_career_stops
  DROP CONSTRAINT IF EXISTS player_career_stops_career_status_check;
ALTER TABLE public.player_career_stops
  ADD CONSTRAINT player_career_stops_career_status_check CHECK (career_status IN ('current', 'former'));
