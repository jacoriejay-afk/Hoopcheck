-- IG-1 security follow-up: keep graph-derived private RPCs authenticated-only.
revoke execute on function public.get_shared_team_followers(uuid) from anon;
revoke execute on function public.get_social_suggestions() from anon;
grant execute on function public.get_shared_team_followers(uuid) to authenticated;
grant execute on function public.get_social_suggestions() to authenticated;
