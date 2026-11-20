-- LOCAL REHEARSAL ONLY. Not a production migration or an approved rollout.
-- Pause new server-issued purchase intents, retaining sync/notification processing
-- and existing Apple/Stripe/manual entitlements. Does not stop in-flight intents.
DO $$ BEGIN
 IF current_database() <> 'hoop_prod_rehearsal' OR inet_server_addr() IS NOT NULL THEN
  RAISE EXCEPTION 'Only the isolated socket rehearsal database is permitted';
 END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.apple_take_purchase_intent(uuid) FROM service_role;
-- No config.enabled change: disabling it also expires existing Apple access.
-- No row mutation, broad SELECT restoration, RPC drop or financial table restore.
