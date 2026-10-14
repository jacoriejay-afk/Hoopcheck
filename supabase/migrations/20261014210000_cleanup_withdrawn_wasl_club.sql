-- Official 2026 WASL Final 8 field excluded BC Astana after its withdrawal; keep its team record/history but deactivate the stale membership.
update public.team_league_memberships m
set active=false
from public.leagues l, public.teams t
where l.id=m.league_id and t.id=m.team_id
and l.name='FIBA West Asia Super League (WASL)'
and m.active=true and lower(t.name)='bc astana';