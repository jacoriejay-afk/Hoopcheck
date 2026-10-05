-- Phase launch hardening: remove anonymous execution of privileged RPCs and index foreign keys.
revoke execute on function public.can_user_review_team(uuid,uuid) from anon;
revoke execute on function public.admin_delete_directory_entry(text,uuid) from anon;
revoke execute on function public.moderate_player_verification(uuid,text,text) from anon;
create index if not exists idx_review_moderation_events_actor_id on public.review_moderation_events(actor_id);
create index if not exists idx_rights_registry_approved_by on public.rights_registry(approved_by);
create index if not exists idx_rights_registry_events_actor_id on public.rights_registry_events(actor_id);