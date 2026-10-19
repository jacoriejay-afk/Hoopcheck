-- Expand women’s professional coverage across Australia, Europe, Japan and Brazil.
-- Idempotent: existing leagues and teams are left untouched.
insert into public.womens_leagues(name,country,level,active)
select v.name,v.country,v.level,true
from (values
  ('Australian WNBL','Australia','Professional'),
  ('Liga Femenina Endesa','Spain','Professional'),
  ('French Women’s League (LFB)','France','Professional'),
  ('Turkish Women’s Basketball Super League','Türkiye','Professional'),
  ('Japan W League','Japan','Professional'),
  ('Brazilian Women’s Basketball League (LBF)','Brazil','Professional')
) v(name,country,level)
where not exists (
  select 1 from public.womens_leagues l where lower(l.name)=lower(v.name)
);

with seed(team,country,city,league_name) as (
  values
  ('Adelaide Lightning','Australia','Adelaide','Australian WNBL'),
  ('Bendigo Spirit','Australia','Bendigo','Australian WNBL'),
  ('Melbourne Boomers','Australia','Melbourne','Australian WNBL'),
  ('Perth Lynx','Australia','Perth','Australian WNBL'),
  ('Southside Flyers','Australia','Melbourne','Australian WNBL'),
  ('Townsville Fire','Australia','Townsville','Australian WNBL'),
  ('Perfumerías Avenida','Spain','Salamanca','Liga Femenina Endesa'),
  ('Uni Girona','Spain','Girona','Liga Femenina Endesa'),
  ('IDK Euskotren','Spain','San Sebastián','Liga Femenina Endesa'),
  ('Kutxabank Araski','Spain','Vitoria-Gasteiz','Liga Femenina Endesa'),
  ('Lointek Gernika Bizkaia','Spain','Gernika-Lumo','Liga Femenina Endesa'),
  ('ASVEL Féminin','France','Lyon','French Women’s League (LFB)'),
  ('Lattes Montpellier','France','Lattes','French Women’s League (LFB)'),
  ('Roche Vendée Basket Club','France','La Roche-sur-Yon','French Women’s League (LFB)'),
  ('Toulouse Métropole Basket','France','Toulouse','French Women’s League (LFB)'),
  ('Fenerbahçe Opet','Türkiye','Istanbul','Turkish Women’s Basketball Super League'),
  ('Galatasaray Çağdaş Faktoring','Türkiye','Istanbul','Turkish Women’s Basketball Super League'),
  ('Beşiktaş Women’s Basketball','Türkiye','Istanbul','Turkish Women’s Basketball Super League'),
  ('Çukurova Basketbol','Türkiye','Mersin','Turkish Women’s Basketball Super League'),
  ('Toyota Antelopes','Japan','Nagoya','Japan W League'),
  ('Denso Iris','Japan','Kariya','Japan W League'),
  ('Fujitsu Red Wave','Japan','Kawasaki','Japan W League'),
  ('ENEOS Sunflowers','Japan','Tokyo','Japan W League'),
  ('Sampaio Basquete','Brazil','São Luís','Brazilian Women’s Basketball League (LBF)'),
  ('SESI Araraquara','Brazil','Araraquara','Brazilian Women’s Basketball League (LBF)'),
  ('Unimed Campinas','Brazil','Campinas','Brazilian Women’s Basketball League (LBF)')
)
insert into public.womens_teams(name,country,city,league_id,active,league_name)
select s.team,s.country,s.city,l.id,true,l.name
from seed s
join public.womens_leagues l on lower(l.name)=lower(s.league_name)
where not exists (
  select 1 from public.womens_teams t
  where lower(t.name)=lower(s.team)
    and lower(coalesce(t.country,''))=lower(coalesce(s.country,''))
);
