-- Both functions only need caller-visible rows; preserve membership and room predicates.
alter function public.current_user_has_live_game_membership() security invoker;
alter function public.current_user_has_live_game_membership() set search_path='';
alter function public.fan_live_chat_room_open(uuid) security invoker;
alter function public.fan_live_chat_room_open(uuid) set search_path='';
