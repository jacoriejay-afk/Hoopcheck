revoke execute on function public.can_user_follow_target(uuid, text, uuid) from public;
grant execute on function public.can_user_follow_target(uuid, text, uuid) to authenticated;
