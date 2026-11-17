-- Explicitly remove inherited Data API privileges; RLS is defense in depth.
revoke all on table public.native2_arena_checkins, public.native2_highlight_assets,
 public.native2_verification_video_assets, public.native2_travel_preferences
 from public, anon, authenticated;
grant select on public.native2_arena_checkins, public.native2_highlight_assets,
 public.native2_verification_video_assets to authenticated;
grant select, insert, update, delete on public.native2_travel_preferences to authenticated;