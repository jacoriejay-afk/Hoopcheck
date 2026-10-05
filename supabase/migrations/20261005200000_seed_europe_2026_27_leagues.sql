-- HoopCheck 2026-27 Europe league catalog.
-- Curated from current FIBA Europe member/competition context and current 2026-27
-- domestic-league references. This stores directory metadata only; it does not
-- copy third-party league databases or protected provider data.

do $$
declare r record;
begin
  update public.leagues
  set season='2026-27'
  where active=true
    and country in ('Albania','Andorra','Armenia','Austria','Azerbaijan','Belarus','Belgium','Bosnia and Herzegovina','Bulgaria','Croatia','Cyprus','Czechia','Denmark','Estonia','Finland','France','Georgia','Germany','Greece','Hungary','Iceland','Ireland','Israel','Italy','Kosovo','Latvia','Lithuania','Luxembourg','Malta','Moldova','Montenegro','Netherlands','North Macedonia','Norway','Poland','Portugal','Romania','Russia','Serbia','Slovakia','Slovenia','Spain','Sweden','Switzerland','Türkiye','Ukraine','United Kingdom');

  create temporary table europe_league_seed(name text, country text, level text) on commit drop;

  insert into europe_league_seed values
  ('Superliga','Albania','Top Division'),('Superliga','Andorra','Top Division'),('Armenian Basketball League A','Armenia','Top Division'),('Basketball Superliga','Austria','Top Division'),('Azerbaijan Basketball League','Azerbaijan','Top Division'),('Premier League','Belarus','Top Division'),('BNXT League','Belgium','Top Division'),('Basketball Championship of Bosnia and Herzegovina','Bosnia and Herzegovina','Top Division'),('National Basketball League','Bulgaria','Top Division'),('Favbet Premijer Liga','Croatia','Top Division'),('OPAP Basket League','Cyprus','Top Division'),('Kooperativa NBL','Czechia','Top Division'),('Basketligaen','Denmark','Top Division'),('Korvpalli Meistriliiga','Estonia','Top Division'),('Korisliiga','Finland','Top Division'),('Betclic Élite','France','Top Division'),('Superleague','Georgia','Top Division'),('Basketball Bundesliga','Germany','Top Division'),('Greek Basketball League','Greece','Top Division'),('NB I/A','Hungary','Top Division'),('Besta deild karla','Iceland','Top Division'),('Super League','Ireland','Top Division'),('Israeli Basketball Premier League','Israel','Top Division'),('Lega Basket Serie A','Italy','Top Division'),('Kosovo Superleague','Kosovo','Top Division'),('Latvian-Estonian Basketball League','Latvia','Top Division'),('LKL','Lithuania','Top Division'),('Ligue Nationale d''Excellence','Luxembourg','Top Division'),('National League','Malta','Top Division'),('Moldovan National Division','Moldova','Top Division'),('Erste Liga','Montenegro','Top Division'),('BNXT League','Netherlands','Top Division'),('First League','North Macedonia','Top Division'),('BLNO','Norway','Top Division'),('ORLEN Basket Liga','Poland','Top Division'),('Liga Betclic','Portugal','Top Division'),('Liga Națională','Romania','Top Division'),('VTB United League','Russia','Regional/Top Professional'),('Košarkaška liga Srbije','Serbia','Top Division'),('Nike SBL','Slovakia','Top Division'),('Liga Nova KBM','Slovenia','Top Division'),('Liga Endesa','Spain','Top Division'),('Svenska Basketligan','Sweden','Top Division'),('SB League','Switzerland','Top Division'),('Türkiye Sigorta Basketbol Süper Ligi','Türkiye','Top Division'),('FBU SuperLeague','Ukraine','Top Division'),('Super League Basketball','United Kingdom','Top Division');

  for r in select * from europe_league_seed loop
    if exists (select 1 from public.leagues where lower(name)=lower(r.name) and lower(coalesce(country,''))=lower(r.country)) then
      update public.leagues set level=coalesce(level,r.level), season='2026-27', active=true
      where lower(name)=lower(r.name) and lower(coalesce(country,''))=lower(r.country);
    else
      insert into public.leagues(name,country,level,season,active,source,last_synced_at)
      values(r.name,r.country,r.level,'2026-27',true,'HoopCheck curated 2026-27 Europe',now());
    end if;
  end loop;
end $$;
