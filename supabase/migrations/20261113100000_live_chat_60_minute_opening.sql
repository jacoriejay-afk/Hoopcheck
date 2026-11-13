-- Align pregame chat opening with the approved 60-minute window.
CREATE OR REPLACE FUNCTION public.fan_live_chat_room_open(p_game_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 select exists (
  select 1 from public.fan_live_games g
  where g.id=p_game_id
   and g.status not in ('final','finished','cancelled','canceled','postponed','abandoned')
   and (g.scheduled_at is not null or g.status = 'live')
   and (g.scheduled_at is null or now() >= g.scheduled_at - interval '60 minutes')
   and (g.ends_at is null or now() < g.ends_at)
 );
$function$;