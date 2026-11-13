-- Run against an isolated database with the claim and fan group migrations.
BEGIN;
DO $test$
<<team_claim_directory_scope>>
DECLARE
  team_id constant uuid := '00000000-0000-0000-0000-000000000101';
  manager_id constant uuid := '00000000-0000-0000-0000-000000000102';
  claim_id uuid;
BEGIN
  INSERT INTO public.profiles(id, account_type) VALUES (manager_id, 'manager');
  INSERT INTO public.teams(id, name) VALUES (team_id, 'Claim scope fixture');
  INSERT INTO public.womens_teams(id, name) VALUES (team_id, 'Women claim scope fixture');

  INSERT INTO public.profile_claim_requests (
    entity_type, entity_id, requester_id, organization_email, verification_method,
    proof_document_path, status, team_directory
  ) VALUES (
    'team', team_id, manager_id, 'manager@club.invalid', 'document',
    manager_id::text || '/claim.pdf', 'approved', 'women'
  ) RETURNING id INTO claim_id;

  IF EXISTS (SELECT FROM public.team_fan_group_moderators m
             WHERE m.team_id = team_claim_directory_scope.team_id AND m.user_id = manager_id) THEN
    RAISE EXCEPTION 'Women claim granted access to the men fan group';
  END IF;

  UPDATE public.profile_claim_requests SET team_directory = 'men' WHERE id = claim_id;
  IF NOT EXISTS (SELECT FROM public.team_fan_group_moderators m
                 WHERE m.team_id = team_claim_directory_scope.team_id
                   AND m.user_id = manager_id AND m.moderator_type = 'club_admin') THEN
    RAISE EXCEPTION 'Approved men claim did not grant club moderation';
  END IF;
  IF NOT EXISTS (SELECT FROM public.team_fan_group_moderators m
                 WHERE m.team_id = team_claim_directory_scope.team_id AND m.moderator_type = 'platform') THEN
    RAISE EXCEPTION 'Approved men claim removed platform moderation';
  END IF;

  UPDATE public.profile_claim_requests SET status = 'rejected' WHERE id = claim_id;
  IF EXISTS (SELECT FROM public.team_fan_group_moderators m
             WHERE m.team_id = team_claim_directory_scope.team_id AND m.user_id = manager_id) THEN
    RAISE EXCEPTION 'Rejecting a claim left club moderation active';
  END IF;
  UPDATE public.profile_claim_requests SET status = 'approved' WHERE id = claim_id;
  DELETE FROM public.profile_claim_requests WHERE id = claim_id;
  IF EXISTS (SELECT FROM public.team_fan_group_moderators m
             WHERE m.team_id = team_claim_directory_scope.team_id AND m.user_id = manager_id) THEN
    RAISE EXCEPTION 'Deleting a claim left club moderation active';
  END IF;
END;
$test$;
ROLLBACK;
