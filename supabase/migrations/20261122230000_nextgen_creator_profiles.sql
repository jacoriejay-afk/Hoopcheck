-- NEXTGEN phase 1: Creator Profiles are an opt-in public showcase layer.
-- No new account type, membership privilege, identity claim or protected profile read.
-- Review in isolated staging before applying to production.
create table if not exists public.creator_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  category text not null default 'media'
    check (category in ('media','podcast','trainer','photographer','analyst','other')),
  headline text not null default '' check (char_length(headline) <= 140),
  description text not null default '' check (char_length(description) <= 600),
  website_url text check (
    website_url is null or (
      char_length(website_url) <= 250 and
      website_url ~* '^https://[a-z0-9][a-z0-9.-]*([:/?#]|$)' and
      website_url !~ '[[:space:]]'
    )
  ),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists creator_profiles_published_idx
  on public.creator_profiles(category, profile_id) where is_published;

alter table public.creator_profiles enable row level security;

-- Respect current owner profile visibility and moderation dynamically: if a
-- profile becomes private or suspended, its creator showcase disappears.
create policy "creator profiles public published"
on public.creator_profiles for select to anon, authenticated
using (
  is_published and exists (
    select 1 from public.profiles p
    where p.id = creator_profiles.profile_id
      and p.profile_visibility = 'public'
      and p.moderation_status = 'normal'
  )
);

create policy "creator profiles own drafts"
on public.creator_profiles for select to authenticated
using (profile_id = (select auth.uid()));

create policy "creator profiles own create"
on public.creator_profiles for insert to authenticated
with check (profile_id = (select auth.uid()));

create policy "creator profiles own edit"
on public.creator_profiles for update to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "creator profiles own remove"
on public.creator_profiles for delete to authenticated
using (profile_id = (select auth.uid()));

-- Table-level grants do not override RLS. No service role is used by the UI.
revoke all on public.creator_profiles from anon, authenticated;
grant select on public.creator_profiles to anon;
grant select, insert, update, delete on public.creator_profiles to authenticated;
comment on table public.creator_profiles is
  'Opt-in public creator showcase, not an identity or professional credential verification.';
