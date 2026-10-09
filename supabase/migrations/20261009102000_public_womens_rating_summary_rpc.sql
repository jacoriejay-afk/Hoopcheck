-- Expose the rating-only RPC through the standard Supabase public API.
-- Review text remains protected by table RLS; this function returns aggregates only.
create or replace function public.get_womens_review_rating_summary(p_team_id uuid)
returns table (
  review_count bigint,
  overall_rating numeric
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    count(*)::bigint,
    case
      when private.is_active_subscriber() or private.is_admin_or_moderator()
      then round(avg(r.overall_rating)::numeric, 2)
      else null
    end
  from public.womens_team_reviews r
  where r.womens_team_id = p_team_id
    and r.status = 'approved'
    and (select auth.uid()) is not null;
$function$;

revoke all on function public.get_womens_review_rating_summary(uuid) from public;
revoke execute on function public.get_womens_review_rating_summary(uuid) from anon;
grant execute on function public.get_womens_review_rating_summary(uuid) to authenticated;
