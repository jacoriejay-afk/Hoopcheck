-- REELS-1 creator follow support — REVIEW ONLY; NOT APPLIED.
-- Verified production constraint:
-- follow_relationships_target_type_check allows team, player, league, fan.
-- This additive change allows creator but does not authorize follow writes.
alter table public.follow_relationships
  drop constraint if exists follow_relationships_target_type_check;
alter table public.follow_relationships
  add constraint follow_relationships_target_type_check
  check (target_type = any (array['team','player','league','fan','creator']::text[]));

-- Follow RLS/API must still validate:
-- 1. follower_id = auth.uid() and target_id is a valid profile with account_type creator;
-- 2. block relationships in both directions;
-- 3. creator verification before displaying verified badge;
-- 4. paid subscription and visibility on Reels read;
-- 5. no access expansion for unrelated targets.
-- Do not deploy this constraint change until the follow API and RLS are reviewed.
