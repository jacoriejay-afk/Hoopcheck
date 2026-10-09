create or replace function private.get_public_review_summary(p_entity_type text, p_entity_id uuid)
returns table(
  review_count bigint,
  overall_rating numeric,
  communication_rating numeric,
  professionalism_rating numeric,
  development_rating numeric,
  payment_rating numeric
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    count(*)::bigint,
    case when private.is_active_subscriber() or private.is_admin_or_moderator() then round(avg(r.overall_rating)::numeric, 2) else null end,
    case when private.is_active_subscriber() or private.is_admin_or_moderator() then round(avg(r.communication_rating)::numeric, 2) else null end,
    case when private.is_active_subscriber() or private.is_admin_or_moderator() then round(avg(r.professionalism_rating)::numeric, 2) else null end,
    case when private.is_active_subscriber() or private.is_admin_or_moderator() then round(avg(r.development_rating)::numeric, 2) else null end,
    case when private.is_active_subscriber() or private.is_admin_or_moderator() then round(avg(r.payment_rating)::numeric, 2) else null end
  from public.reviews r
  where r.status = 'approved'
    and (
      (p_entity_type = 'coach' and r.coach_id = p_entity_id)
      or (p_entity_type = 'team' and r.team_id = p_entity_id)
      or (p_entity_type = 'league' and r.league_id = p_entity_id)
    );
$function$;
