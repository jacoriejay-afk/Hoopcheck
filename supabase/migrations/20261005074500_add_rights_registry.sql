-- HoopCheck Rights & Coverage Center
-- Legal/rights registry is intentionally separate from directory data.
-- A provider/research relationship never implies redistribution permission.

create table if not exists public.rights_registry (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  country_code text,
  league_name text not null,
  league_short_name text,
  data_owner text,
  research_lead text,
  research_status text not null default 'research_required'
    check (research_status in ('research_required','research_in_progress','research_complete')),
  commercial_use_allowed boolean,
  redistribution_allowed boolean,
  production_approved boolean not null default false,
  license_path text,
  evidence_url text,
  evidence_note text,
  notes text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(country_code, league_name)
);

alter table public.rights_registry enable row level security;

drop policy if exists "rights_registry_admin_read" on public.rights_registry;
drop policy if exists "rights_registry_admin_insert" on public.rights_registry;
drop policy if exists "rights_registry_admin_update" on public.rights_registry;
drop policy if exists "rights_registry_admin_delete" on public.rights_registry;

create policy "rights_registry_admin_read"
  on public.rights_registry for select to authenticated
  using (public.is_current_user_admin_or_moderator());

create policy "rights_registry_admin_insert"
  on public.rights_registry for insert to authenticated
  with check (public.is_current_user_admin_or_moderator());

create policy "rights_registry_admin_update"
  on public.rights_registry for update to authenticated
  using (public.is_current_user_admin_or_moderator())
  with check (public.is_current_user_admin_or_moderator());

create policy "rights_registry_admin_delete"
  on public.rights_registry for delete to authenticated
  using (public.is_current_user_admin_or_moderator());

create index if not exists rights_registry_country_idx
  on public.rights_registry(country, league_name);

create index if not exists rights_registry_status_idx
  on public.rights_registry(research_status, production_approved);

create or replace function public.touch_rights_registry_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rights_registry_updated_at on public.rights_registry;
create trigger rights_registry_updated_at
before update on public.rights_registry
for each row execute function public.touch_rights_registry_updated_at();

insert into public.rights_registry
(country, country_code, league_name, league_short_name, data_owner, research_lead, research_status,
 commercial_use_allowed, redistribution_allowed, production_approved, license_path, evidence_url, evidence_note, notes, last_verified_at)
values
('Germany','DE','Basketball Bundesliga','BBL',null,'Genius Sports','research_complete',false,false,false,'Potential licensed/API route','https://about.fiba.basketball/en/services/data-and-video-solutions/genius-sports','FIBA identifies Genius Sports as a long-term technology/data partner; this does not itself grant HoopCheck redistribution rights.','Rights relationship requires league/provider-specific licensing before production.',now()),
('France','FR','Betclic Élite','Betclic Élite',null,'Genius Sports','research_complete',false,false,false,'Potential licensed/API route','https://about.fiba.basketball/en/services/data-and-video-solutions/genius-sports','FIBA identifies Genius Sports as a long-term technology/data partner; this does not itself grant HoopCheck redistribution rights.','Rights relationship requires league/provider-specific licensing before production.',now()),
('Italy','IT','Lega Basket Serie A','LBA',null,'Genius Sports','research_complete',false,false,false,'Potential licensed/API route','https://about.fiba.basketball/en/services/data-and-video-solutions/genius-sports','FIBA identifies Genius Sports as a long-term technology/data partner; this does not itself grant HoopCheck redistribution rights.','Rights relationship requires league/provider-specific licensing before production.',now()),
('Greece','GR','Greek Basketball League','GBL',null,'Genius Sports','research_complete',false,false,false,'Potential licensed/API route','https://about.fiba.basketball/en/services/data-and-video-solutions/genius-sports','FIBA identifies Genius Sports as a long-term technology/data partner; this does not itself grant HoopCheck redistribution rights.','Rights relationship requires league/provider-specific licensing before production.',now()),
('Türkiye','TR','Basketbol Süper Ligi','BSL',null,'Genius Sports','research_complete',false,false,false,'Potential licensed/API route','https://about.fiba.basketball/en/services/data-and-video-solutions/genius-sports','FIBA identifies Genius Sports as a long-term technology/data partner; this does not itself grant HoopCheck redistribution rights.','Rights relationship requires league/provider-specific licensing before production.',now()),
('Poland','PL','Polish Basketball League','PLK',null,'Genius Sports','research_complete',false,false,false,'Potential licensed/API route','https://about.fiba.basketball/en/services/data-and-video-solutions/genius-sports','FIBA identifies Genius Sports as a long-term technology/data partner; this does not itself grant HoopCheck redistribution rights.','Rights relationship requires league/provider-specific licensing before production.',now()),
('Lithuania','LT','LKL','LKL',null,'Genius Sports','research_complete',false,false,false,'Potential licensed/API route','https://about.fiba.basketball/en/services/data-and-video-solutions/genius-sports','FIBA identifies Genius Sports as a long-term technology/data partner; this does not itself grant HoopCheck redistribution rights.','Rights relationship requires league/provider-specific licensing before production.',now()),
('Serbia','RS','KLS','KLS',null,'Genius Sports','research_complete',false,false,false,'Potential licensed/API route','https://about.fiba.basketball/en/services/data-and-video-solutions/genius-sports','FIBA identifies Genius Sports as a long-term technology/data partner; this does not itself grant HoopCheck redistribution rights.','Rights relationship requires league/provider-specific licensing before production.',now()),
('Portugal','PT','Liga Betclic','Liga Betclic',null,'Genius Sports','research_complete',false,false,false,'Potential licensed/API route','https://about.fiba.basketball/en/services/data-and-video-solutions/genius-sports','FIBA identifies Genius Sports as a long-term technology/data partner; this does not itself grant HoopCheck redistribution rights.','Rights relationship requires league/provider-specific licensing before production.',now())
on conflict (country_code, league_name) do update set
  league_short_name=excluded.league_short_name,
  research_lead=excluded.research_lead,
  research_status=excluded.research_status,
  commercial_use_allowed=excluded.commercial_use_allowed,
  redistribution_allowed=excluded.redistribution_allowed,
  production_approved=excluded.production_approved,
  license_path=excluded.license_path,
  evidence_url=excluded.evidence_url,
  evidence_note=excluded.evidence_note,
  notes=excluded.notes,
  last_verified_at=excluded.last_verified_at;
