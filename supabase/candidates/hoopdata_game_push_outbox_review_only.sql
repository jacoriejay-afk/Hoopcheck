-- HOOPDATA-1 REVIEW ONLY. Queue only, no actual push delivery or device token collection.
BEGIN;
CREATE TABLE public.hoopdata_game_push_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.fan_live_games(id) ON DELETE CASCADE,
  event_kind text NOT NULL CHECK(event_kind IN ('game-day','tip-off')),
  scheduled_tipoff timestamptz NOT NULL,
  available_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','cancelled','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
  lease_until timestamptz,
  sent_at timestamptz,
  UNIQUE(user_id,game_id,event_kind),
  CHECK((status='sending')=(lease_until IS NOT NULL)),
  CHECK((status='sent')=(sent_at IS NOT NULL))
);
CREATE INDEX hoopdata_push_outbox_due ON public.hoopdata_game_push_outbox(available_at) WHERE status='pending';
ALTER TABLE public.hoopdata_game_push_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hoopdata_game_push_outbox FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.hoopdata_game_push_outbox TO service_role;
-- No default opt-in. No trigger, cron, token or sender is provisioned.
CREATE TABLE public.hoopdata_game_push_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hoopdata_game_push_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hoopdata_game_push_preferences FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.hoopdata_game_push_preferences TO authenticated;
GRANT INSERT(user_id,enabled),UPDATE(enabled) ON public.hoopdata_game_push_preferences TO authenticated;
GRANT SELECT ON public.hoopdata_game_push_preferences TO service_role;
CREATE POLICY hoopdata_push_pref_select ON public.hoopdata_game_push_preferences FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY hoopdata_push_pref_insert ON public.hoopdata_game_push_preferences FOR INSERT TO authenticated WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY hoopdata_push_pref_update ON public.hoopdata_game_push_preferences FOR UPDATE TO authenticated USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()));
COMMIT;
