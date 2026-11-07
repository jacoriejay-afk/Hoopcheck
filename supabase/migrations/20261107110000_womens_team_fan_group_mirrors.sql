-- Fan HQ parity: give every women's directory team the same club Fan Group
-- backing record as men's teams. The mirrored row reuses the women's team UUID,
-- so existing follow relationships, group membership, moderation and post RLS
-- continue to use one shared Fan Group implementation.

create or replace function public.sync_womens_team_fan_group_mirror()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.teams t
    where t.id = old.id
      and t.source = 'womens_teams_mirror';
    return old;
  end if;

  insert into public.teams as existing
    (id, name, country, city, league_name, active, basketball_type, logo_url, logo_bg, source)
  values
    (new.id, new.name, new.country, new.city, new.league_name, new.active,
     'womens', new.logo_url, new.logo_bg, 'womens_teams_mirror')
  on conflict (id) do update set
    name = excluded.name,
    country = excluded.country,
    city = excluded.city,
    league_name = excluded.league_name,
    active = excluded.active,
    basketball_type = 'womens',
    logo_url = excluded.logo_url,
    logo_bg = excluded.logo_bg
  where existing.source = 'womens_teams_mirror';

  return new;
end;
$$;

drop trigger if exists womens_teams_sync_fan_group_mirror on public.womens_teams;
create trigger womens_teams_sync_fan_group_mirror
after insert or update or delete on public.womens_teams
for each row execute function public.sync_womens_team_fan_group_mirror();

-- Backfill existing women's teams. The teams_ensure_fan_group trigger creates
-- the matching group automatically; the explicit upsert makes this migration
-- safe if that trigger was disabled during a previous import.
insert into public.teams as existing
  (id, name, country, city, league_name, active, basketball_type, logo_url, logo_bg, source)
select
  w.id, w.name, w.country, w.city, w.league_name, w.active,
  'womens', w.logo_url, w.logo_bg, 'womens_teams_mirror'
from public.womens_teams w
on conflict (id) do update set
  name = excluded.name,
  country = excluded.country,
  city = excluded.city,
  league_name = excluded.league_name,
  active = excluded.active,
  basketball_type = 'womens',
  logo_url = excluded.logo_url,
  logo_bg = excluded.logo_bg
where existing.source = 'womens_teams_mirror';

insert into public.team_fan_groups (team_id, group_name)
select t.id, t.name || ' Fan Group'
from public.teams t
where t.basketball_type = 'womens'
  and t.source = 'womens_teams_mirror'
on conflict (team_id) do nothing;
