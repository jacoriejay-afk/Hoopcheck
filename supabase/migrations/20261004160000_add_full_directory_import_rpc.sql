-- Relationship-aware full directory import.
-- Runs as the authenticated caller and relies on existing admin/moderator RLS policies.

alter table public.directory_import_jobs
  drop constraint if exists directory_import_jobs_kind_check;

alter table public.directory_import_jobs
  add constraint directory_import_jobs_kind_check
  check (kind in ('coaches','teams','leagues','full_directory'));

create or replace function public.import_full_directory(p_file_name text, p_rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_job_id uuid;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
  v_errors integer := 0;
  r jsonb;
  v_league_id uuid;
  v_team_id uuid;
  v_coach_id uuid;
  v_name text;
  v_country text;
  v_city text;
  v_season text;
  v_start_date date;
  v_end_date date;
  v_role text;
  v_level text;
  v_existing boolean;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not public.is_current_user_admin_or_moderator() then raise exception 'Admin or moderator access required'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'p_rows must be a JSON array'; end if;

  insert into public.directory_import_jobs(imported_by, kind, file_name, total_rows)
  values ((select auth.uid()), 'full_directory', nullif(trim(p_file_name), ''), jsonb_array_length(p_rows))
  returning id into v_job_id;

  for r in select value from jsonb_array_elements(p_rows)
  loop
    begin
      v_name := nullif(trim(r->>'league_name'), '');
      v_country := nullif(trim(r->>'league_country'), '');
      v_level := nullif(trim(r->>'league_level'), '');
      v_season := nullif(trim(r->>'season'), '');
      if v_name is null then v_errors := v_errors + 1; continue; end if;

      select l.id into v_league_id from public.leagues l
      where lower(trim(l.name))=lower(v_name)
        and coalesce(lower(trim(l.country)),'')=coalesce(lower(v_country),'')
      order by l.active desc,l.created_at desc limit 1;
      v_existing := v_league_id is not null;

      if v_existing then
        update public.leagues set level=coalesce(v_level,level),season=coalesce(v_season,season),active=true where id=v_league_id;
        v_updated := v_updated + 1;
      else
        insert into public.leagues(name,country,level,season,active)
        values(v_name,v_country,v_level,v_season,true) returning id into v_league_id;
        v_inserted := v_inserted + 1;
      end if;

      v_name := nullif(trim(r->>'team_name'),'');
      v_country := nullif(trim(r->>'team_country'),'');
      v_city := nullif(trim(r->>'team_city'),'');
      if v_name is not null then
        select t.id into v_team_id from public.teams t
        where lower(trim(t.name))=lower(v_name)
          and coalesce(lower(trim(t.country)),'')=coalesce(lower(v_country),'')
        order by t.active desc,t.created_at desc limit 1;
        v_existing := v_team_id is not null;

        if v_existing then
          update public.teams set city=coalesce(v_city,city),league_name=(select name from public.leagues where id=v_league_id),league_id=v_league_id,active=true where id=v_team_id;
          v_updated := v_updated + 1;
        else
          insert into public.teams(name,country,city,league_name,league_id,active)
          values(v_name,v_country,v_city,(select name from public.leagues where id=v_league_id),v_league_id,true)
          returning id into v_team_id;
          v_inserted := v_inserted + 1;
        end if;

        v_season := nullif(trim(r->>'season'),'');
        v_start_date := nullif(trim(r->>'start_date'),'')::date;
        v_end_date := nullif(trim(r->>'end_date'),'')::date;

        insert into public.team_league_memberships(team_id,league_id,season,start_date,end_date,active)
        values(v_team_id,v_league_id,v_season,v_start_date,v_end_date,true)
        on conflict (team_id,league_id,season) do update
        set start_date=excluded.start_date,end_date=excluded.end_date,active=true;

        v_name := nullif(trim(r->>'coach_name'),'');
        v_country := nullif(trim(r->>'coach_country'),'');
        v_city := nullif(trim(r->>'coach_city'),'');
        v_role := nullif(trim(r->>'coach_role'),'');
        if v_name is not null then
          select c.id into v_coach_id from public.coaches c
          where lower(trim(c.name))=lower(v_name)
            and coalesce(lower(trim(c.country)),'')=coalesce(lower(v_country),'')
          order by c.active desc,c.created_at desc limit 1;
          v_existing := v_coach_id is not null;

          if v_existing then
            update public.coaches set city=coalesce(v_city,city),current_team_id=v_team_id,active=true where id=v_coach_id;
            v_updated := v_updated + 1;
          else
            insert into public.coaches(name,country,city,current_team_id,active)
            values(v_name,v_country,v_city,v_team_id,true)
            returning id into v_coach_id;
            v_inserted := v_inserted + 1;
          end if;

          insert into public.coach_team_assignments(coach_id,team_id,role,season,start_date,end_date,active)
          values(v_coach_id,v_team_id,v_role,v_season,v_start_date,v_end_date,true)
          on conflict (coach_id,team_id,season) do update
          set role=excluded.role,start_date=excluded.start_date,end_date=excluded.end_date,active=true;
        end if;
      end if;
    exception when others then
      v_errors := v_errors + 1;
    end;
  end loop;

  update public.directory_import_jobs
  set inserted_rows=v_inserted,updated_rows=v_updated,skipped_rows=v_skipped,error_rows=v_errors
  where id=v_job_id;

  return jsonb_build_object(
    'job_id',v_job_id,
    'total_rows',jsonb_array_length(p_rows),
    'inserted_rows',v_inserted,
    'updated_rows',v_updated,
    'skipped_rows',v_skipped,
    'error_rows',v_errors
  );
end;
$$;

revoke all on function public.import_full_directory(text,jsonb) from public;
revoke all on function public.import_full_directory(text,jsonb) from anon;
grant execute on function public.import_full_directory(text,jsonb) to authenticated;
