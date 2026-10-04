-- Global directory search performance.
-- The directory uses case-insensitive partial matching across names and locations.
-- Trigram indexes keep those searches responsive as the worldwide database grows.

create extension if not exists pg_trgm;

create index if not exists coaches_name_trgm_idx
  on public.coaches using gin (name gin_trgm_ops);

create index if not exists coaches_country_trgm_idx
  on public.coaches using gin (country gin_trgm_ops);

create index if not exists coaches_city_trgm_idx
  on public.coaches using gin (city gin_trgm_ops);

create index if not exists teams_name_trgm_idx
  on public.teams using gin (name gin_trgm_ops);

create index if not exists teams_country_trgm_idx
  on public.teams using gin (country gin_trgm_ops);

create index if not exists teams_city_trgm_idx
  on public.teams using gin (city gin_trgm_ops);

create index if not exists teams_league_name_trgm_idx
  on public.teams using gin (league_name gin_trgm_ops);

create index if not exists leagues_name_trgm_idx
  on public.leagues using gin (name gin_trgm_ops);

create index if not exists leagues_country_trgm_idx
  on public.leagues using gin (country gin_trgm_ops);

create index if not exists leagues_level_trgm_idx
  on public.leagues using gin (level gin_trgm_ops);
