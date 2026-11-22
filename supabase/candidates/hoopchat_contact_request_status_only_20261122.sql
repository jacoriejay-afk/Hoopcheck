-- HoopCheck independent security hotfix CANDIDATE: restrict authenticated
-- contact-request UPDATE to accepted/rejected status and responded_at only.
-- The old table-wide UPDATE allowed an accepted participant to attempt changing
-- requester_id/player_id/message, even though the UI writes only status and time.
-- Preserve existing owner, table RLS/SELECT/INSERT, service_role and player policies.
-- Production application requires authorized atomic migration and real-user smoke.
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='4s';
DO $guard$
DECLARE t oid;
BEGIN
 t:=to_regclass('public.player_contact_requests');
 IF t IS NULL OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid=t)
    OR NOT has_table_privilege('authenticated',t,'UPDATE')
    OR has_table_privilege('anon',t,'UPDATE')
    OR NOT has_table_privilege('authenticated',t,'SELECT')
    OR NOT has_table_privilege('service_role',t,'UPDATE')
    OR NOT EXISTS(SELECT 1 FROM pg_policy
        WHERE polrelid=t AND polname='players can respond to requests' AND polcmd='w')
    OR NOT EXISTS(SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='player_contact_requests'
          AND column_name='responded_at')
 THEN RAISE EXCEPTION 'HoopChat contact privilege baseline drift: stop without changes'; END IF;
END $guard$;

REVOKE UPDATE ON TABLE public.player_contact_requests FROM authenticated;
GRANT UPDATE(status,responded_at) ON TABLE public.player_contact_requests TO authenticated;

DO $post$
DECLARE t oid:=to_regclass('public.player_contact_requests');
BEGIN
 IF has_table_privilege('authenticated',t,'UPDATE')
    OR has_column_privilege('authenticated',t,'requester_id','UPDATE')
    OR has_column_privilege('authenticated',t,'player_id','UPDATE')
    OR has_column_privilege('authenticated',t,'message','UPDATE')
    OR has_column_privilege('authenticated',t,'created_at','UPDATE')
    OR has_column_privilege('authenticated',t,'id','UPDATE')
    OR NOT has_column_privilege('authenticated',t,'status','UPDATE')
    OR NOT has_column_privilege('authenticated',t,'responded_at','UPDATE')
    OR NOT has_table_privilege('authenticated',t,'SELECT')
    OR NOT has_table_privilege('authenticated',t,'INSERT')
    OR has_table_privilege('anon',t,'UPDATE')
    OR NOT has_table_privilege('service_role',t,'UPDATE')
    OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid=t)
 THEN RAISE EXCEPTION 'HoopChat least-privilege postcheck failed, roll back'; END IF;
END $post$;