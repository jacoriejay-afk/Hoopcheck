create or replace function public.can_user_review_team(p_user_id uuid, p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $function$
  select (select auth.uid()) is not null
    and p_user_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      join public.player_team_affiliations a on a.user_id = p.id
      where p.id = (select auth.uid())
        and p.player_verified = true
        and a.team_id = p_team_id
        and a.verified = true
        and a.relationship in ('current', 'former')
    );
$function$;
