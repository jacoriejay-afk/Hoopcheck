-- GROUPS-1 Part B: additive identity staging ONLY.
-- This migration does not merge, delete, or reparent existing records.
-- No name-based automatic club matching: identity requires reviewed mappings.
begin;
alter table public.team_fan_groups
  add column if not exists kind text not null default 'official_club',
  add column if not exists category text not null default 'club',
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists privacy text not null default 'public',
  add column if not exists description text;
alter table public.team_fan_groups
  drop constraint if exists team_fan_groups_kind_check;
alter table public.team_fan_groups
  add constraint team_fan_groups_kind_check check (kind in ('official_club','community'));
alter table public.team_fan_groups
  drop constraint if exists team_fan_groups_category_check;
alter table public.team_fan_groups
  add constraint team_fan_groups_category_check check (category in ('club','players','fans','coaches','agents','scouts','teams','open'));
alter table public.team_fan_groups
  drop constraint if exists team_fan_groups_privacy_check;
alter table public.team_fan_groups
  add constraint team_fan_groups_privacy_check check (privacy in ('public','private'));
-- Existing rows are official clubs; do not permit community inserts via existing API.
update public.team_fan_groups
set kind='official_club',category='club',privacy='public',created_by=null
where kind='official_club';

-- Reviewed mapping staging: one team -> one canonical survivor team.
-- No public client grants; review and migration must be performed by privileged operators.
create table if not exists public.hoopgroup_club_identity_review (
  team_id uuid primary key references public.teams(id) on delete restrict,
  canonical_team_id uuid not null references public.teams(id) on delete restrict,
  reviewed_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  evidence text not null check (length(trim(evidence)) >= 12),
  constraint hoopgroup_review_no_self check (team_id <> canonical_team_id)
);
alter table public.hoopgroup_club_identity_review enable row level security;
revoke all on public.hoopgroup_club_identity_review from anon, authenticated;
grant all on public.hoopgroup_club_identity_review to service_role;
create index if not exists hoopgroup_club_review_canonical_idx
  on public.hoopgroup_club_identity_review(canonical_team_id);

-- Old route IDs can later resolve to surviving group IDs. Empty until a
-- separately verified merge transaction commits.
create table if not exists public.hoopgroup_retired_group_redirects (
  retired_team_id uuid primary key references public.teams(id) on delete restrict,
  survivor_team_id uuid not null references public.teams(id) on delete restrict,
  merged_at timestamptz not null default now(),
  audit_note text not null,
  constraint hoopgroup_redirect_not_self check (retired_team_id <> survivor_team_id)
);
alter table public.hoopgroup_retired_group_redirects enable row level security;
revoke all on public.hoopgroup_retired_group_redirects from anon, authenticated;
grant all on public.hoopgroup_retired_group_redirects to service_role;
commit;
