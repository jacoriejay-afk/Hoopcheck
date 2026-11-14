-- REELS-1: creator-follow validation implementation candidate.
-- NOT APPLIED. Requires production-like JWT test fixtures before deployment.
-- This trigger validates creator follow writes without changing existing follow types.
create or replace function private.validate_creator_follow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  target_role text;
begin
  if new.target_type <> 'creator' then
    return new;
  end if;

  -- Ownership is checked independently of RLS, since triggers can run
  -- through privileged paths and service-role writes.
  if auth.uid() is null or new.follower_id is distinct from auth.uid() then
    raise exception 'Creator follow requires an authenticated follower'
      using errcode = '42501';
  end if;

  if new.follower_id = new.target_id then
    raise exception 'Cannot follow your own profile'
      using errcode = '23514';
  end if;

  select p.account_type into target_role
  from public.profiles p where p.id = new.target_id;

  if target_role is distinct from 'creator' then
    raise exception 'Invalid creator follow target'
      using errcode = '23514';
  end if;

  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = new.follower_id and b.blocked_id = new.target_id)
       or (b.blocker_id = new.target_id and b.blocked_id = new.follower_id)
  ) then
    raise exception 'Creator follow is unavailable'
      using errcode = '42501';
  end if;

  return new;
end;
$fn$;

revoke all on function private.validate_creator_follow() from public, anon, authenticated;
drop trigger if exists validate_creator_follow_before_write on public.follow_relationships;
create trigger validate_creator_follow_before_write
before insert or update of follower_id, target_type, target_id
on public.follow_relationships
for each row execute function private.validate_creator_follow();

-- Deployment ordering:
-- 1. Verify creator role provisioning and immutable verification badge.
-- 2. Install trigger and add creator to follow_relationships target_type CHECK.
-- 3. Extend visibility functions and count RPC to creator safely.
-- 4. Exercise JWT cases (self, other-user, wrong type, blocked both ways,
--    missing target, legitimate follow, duplicate, UPDATE target, legacy types).
-- 5. Do not enable creator UI until all tests pass.
