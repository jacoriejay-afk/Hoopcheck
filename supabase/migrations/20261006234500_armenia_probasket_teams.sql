-- Armenia ProBasket A-League expansion, 2025-26 verified roster
-- Sources: Armenpress 2025/26 A-League coverage and Sportaran 2025/26 season coverage.
insert into public.leagues(name,country,level,season,source,active)
values ('ProBasket Armenia A-League','Armenia','Top Division','2025-26','manual-curated-armenia-2025-26',true)
on conflict do nothing;

with additions(name,city) as (values
('Urartu','Yerevan'),
('BKMA','Yerevan'),
('Artik','Artik'),
('Olimpavan','Yerevan'),
('Erebuni','Yerevan'),
('Hatis','Yerevan'),
('US Titans','United States'),
('Phoenix Perception','United States')
)
insert into public.teams(name,country,city,league_id,league_name,source,active)
select a.name,case when a.name in ('US Titans','Phoenix Perception') then 'United States' else 'Armenia' end,a.city,l.id,l.name,'manual-curated-armenia-2025-26',true
from additions a
join public.leagues l on l.name='ProBasket Armenia A-League' and l.country='Armenia'
where not exists(
  select 1 from public.teams t
  where lower(t.name)=lower(a.name)
    and lower(coalesce(t.country,''))=lower(case when a.name in ('US Titans','Phoenix Perception') then 'United States' else 'Armenia' end)
);
