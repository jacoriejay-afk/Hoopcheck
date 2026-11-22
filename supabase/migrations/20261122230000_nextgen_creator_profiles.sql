-- NEXTGEN-10 Phase 1: explicit professional and creator showcases.
-- Existing agent/scout profile rows stay PRIVATE under the installed trigger.
-- Public API projections are reviewed, field-allowlisted and moderation scoped.
-- No existing profile permissions, RLS, functions, identity fields, roles,
-- subscriptions or membership entitlements are modified.

create table if not exists public.creator_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  public_name text not null default '' check (char_length(public_name) <= 80),
  country text not null default '' check (char_length(country) <= 80),
  category text not null default 'media'
    check (category in ('media','podcast','trainer','photographer','analyst','other')),
  headline text not null default '' check (char_length(headline) <= 140),
  description text not null default '' check (char_length(description) <= 600),
  website_url text check (
    website_url is null or (char_length(website_url) <= 250 and
    website_url ~* '^https://[a-z0-9][a-z0-9.-]*([:/?#]|$)' and website_url !~ '[[:space:]]')
  ),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_published_requires_name check (
    not is_published or char_length(btrim(public_name)) >= 2
  )
);
create index if not exists creator_profiles_published_idx
  on public.creator_profiles(category, profile_id) where is_published;
alter table public.creator_profiles enable row level security;

-- These policies are defense in depth. Direct client grants are REVOKED:
-- studio writes happen only through a server API that verifies the JWT user.
create policy "creator profiles own drafts" on public.creator_profiles
  for select to authenticated using (profile_id = (select auth.uid()));
create policy "creator profiles own create" on public.creator_profiles
  for insert to authenticated with check (profile_id = (select auth.uid()));
create policy "creator profiles own edit" on public.creator_profiles
  for update to authenticated using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));
create policy "creator profiles own remove" on public.creator_profiles
  for delete to authenticated using (profile_id = (select auth.uid()));
revoke all on public.creator_profiles from anon, authenticated;
grant select, insert, update, delete on public.creator_profiles to service_role;

create table if not exists public.agent_showcases (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  public_name text not null default '' check (char_length(public_name) <= 80),
  agency_name text not null default '' check (char_length(agency_name) <= 120),
  headline text not null default '' check (char_length(headline) <= 140),
  description text not null default '' check (char_length(description) <= 600),
  country text not null default '' check (char_length(country) <= 80),
  website_url text check (
    website_url is null or (char_length(website_url) <= 250 and
    website_url ~* '^https://[a-z0-9][a-z0-9.-]*([:/?#]|$)' and website_url !~ '[[:space:]]')
  ),
  is_published boolean not null default false,
  review_status text not null default 'unreviewed'
    check (review_status in ('unreviewed','approved','rejected')),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_published_requires_name check (
    not is_published or char_length(btrim(public_name)) >= 2
  )
);
create index if not exists agent_showcases_published_idx
  on public.agent_showcases(profile_id) where is_published;
alter table public.agent_showcases enable row level security;
create policy "agent showcases own drafts" on public.agent_showcases
  for select to authenticated using (profile_id = (select auth.uid()));
create policy "agent showcases own create" on public.agent_showcases
  for insert to authenticated with check (profile_id = (select auth.uid()));
create policy "agent showcases own edit" on public.agent_showcases
  for update to authenticated using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));
create policy "agent showcases own remove" on public.agent_showcases
  for delete to authenticated using (profile_id = (select auth.uid()));
revoke all on public.agent_showcases from anon, authenticated;
grant select, insert, update, delete on public.agent_showcases to service_role;

comment on table public.creator_profiles is
 'Owner-opted public creator showcase; does not change the account role or private profile visibility.';
comment on table public.agent_showcases is
 'Owner-opted professional showcase; does not publish private agent/scout account fields or attest credentials.';
