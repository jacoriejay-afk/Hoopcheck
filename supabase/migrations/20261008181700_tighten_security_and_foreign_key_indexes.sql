revoke execute on function public.can_user_follow_target(uuid, text, uuid) from public;
grant execute on function public.can_user_follow_target(uuid, text, uuid) to authenticated;

create index if not exists coach_team_requests_reviewer_id_idx
  on public.coach_team_requests(reviewer_id);
create index if not exists directory_team_requests_requester_id_idx
  on public.directory_team_requests(requester_id);
create index if not exists directory_team_requests_reviewer_id_idx
  on public.directory_team_requests(reviewer_id);
create index if not exists fan_live_chat_messages_user_id_idx
  on public.fan_live_chat_messages(user_id);
create index if not exists identity_verification_sessions_user_id_idx
  on public.identity_verification_sessions(user_id);
create index if not exists player_contact_messages_sender_id_idx
  on public.player_contact_messages(sender_id);
create index if not exists profiles_coach_profile_id_idx
  on public.profiles(coach_profile_id);
