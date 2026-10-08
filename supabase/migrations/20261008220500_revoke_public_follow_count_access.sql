-- Follow counts are not part of the unauthenticated product surface.
revoke execute on function public.get_follow_count(text,uuid) from anon;
