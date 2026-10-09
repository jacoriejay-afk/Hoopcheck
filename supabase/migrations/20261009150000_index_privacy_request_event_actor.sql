-- Support lookups and joins by the actor who created a privacy-request audit event.
CREATE INDEX IF NOT EXISTS privacy_request_events_actor_id_idx
  ON public.privacy_request_events (actor_id);
