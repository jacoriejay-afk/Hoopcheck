-- HoopCheck identity verification, role privacy, and review permissions
-- 2026-10-06

alter table public.profiles
  add column if not exists stripe_identity_verification_session_id text,
  add column if not exists identity_verification_status text not null default 'not_started'
    check (identity_verification_status in ('not_started','requires_input','processing','verified','canceled','failed'));

create index if not exists idx_profiles_identity_verification
  on public.profiles(stripe_identity_verification_session_id);

-- Scouts, agents, and fans are private by product policy.
create or replace function public.enforce_private_nonplayer_profiles()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.account_type in ('scout','agent','fan') then
    new.profile_visibility := 'private';
    new.current_country := null;
    new.current_team := null;
    new.avatar_url := null;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_private_nonplayer_profiles on public.profiles;
create trigger enforce_private_nonplayer_profiles
before insert or update on public.profiles
for each row execute function public.enforce_private_nonplayer_profiles();

update public.profiles
set profile_visibility='private'
where account_type in ('scout','agent','fan')
  and profile_visibility is distinct from 'private';

-- Defense in depth: only verified players can create reviews/ratings.
drop policy if exists "reviews authenticated insert" on public.reviews;
drop policy if exists "reviews_authored_insert" on public.reviews;
create policy "reviews verified players insert"
on public.reviews
for insert to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.account_type = 'player'
      and p.player_verified = true
  )
);

create table if not exists public.identity_verification_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_session_id text not null unique,
  status text not null default 'requires_input',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.identity_verification_sessions enable row level security;

drop policy if exists "identity verification own read" on public.identity_verification_sessions;
create policy "identity verification own read"
on public.identity_verification_sessions
for select to authenticated
using (user_id = auth.uid() or public.is_current_user_admin_or_moderator());

drop policy if exists "identity verification own insert" on public.identity_verification_sessions;
create policy "identity verification own insert"
on public.identity_verification_sessions
for insert to authenticated
with check (user_id = auth.uid());
