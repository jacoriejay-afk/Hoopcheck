-- Add a nullable, first-party-hosted crest URL to women's teams.
-- Men's teams already have teams.logo_url; no production logo data is changed here.
alter table public.womens_teams
  add column if not exists logo_url text;

comment on column public.womens_teams.logo_url is
  'URL of a team crest copied to HoopCheck-controlled storage; never a third-party hotlink.';
