-- Official 2026 LBF lineup: https://lbf.com.br/noticias/pronta-para-comecar/
-- 2026 WNBA participants: https://stats.wnba.com/teams/
with lbf as (
  select id, name from public.womens_leagues
  where name = 'Brazilian LBF' and country = 'Brazil' and active
  order by id limit 1
), entrants(name, city) as (
  values
    ('ADRM Maringá', 'Maringá'),
    ('Santo André', 'Santo André'),
    ('São José Basketball', 'São José dos Campos'),
    ('Unimed Campinas Basquete', 'Campinas'),
    ('SESI Araraquara Basquete', 'Araraquara'),
    ('Sodiê Mesquita', 'Mesquita'),
    ('Cerrado Basquete', 'Brasília'),
    ('Salvador Basketball', 'Salvador'),
    ('Sport Club do Recife', 'Recife'),
    ('Sampaio Basquete', 'São Luís')
)
insert into public.womens_teams(name, country, city, league_id, league_name, active)
select e.name, 'Brazil', e.city, l.id, l.name, true
from entrants e cross join lbf l
where not exists (
  select 1 from public.womens_teams t where lower(t.name) = lower(e.name) and t.country = 'Brazil'
);

-- Reuse existing franchise records, preserving IDs and profile references.
with wnba as (
  select id, name from public.womens_leagues
  where name = 'Women''s National Basketball Association (WNBA)' and country = 'United States' and active
  order by id limit 1
)
update public.womens_teams t set league_id = l.id, league_name = l.name, active = true
from wnba l
where t.country = 'United States' and t.name in ('Minnesota Lynx', 'Phoenix Mercury', 'New York Liberty', 'Las Vegas Aces')
  and t.league_name = 'WNBA'
  and not exists (select 1 from public.womens_teams duplicate where duplicate.name = t.name and duplicate.active and duplicate.id <> t.id);
