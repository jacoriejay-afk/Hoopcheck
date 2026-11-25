-- BUILD16-DIRECTORY #1040: read-only reconciliation report.
-- Run only as an authorized operator. No DDL, DML, provider calls, or automatic merges.
-- teams is a mixed-side canonical table; womens_teams contains legacy authoritative
-- entries mirrored into teams with the SAME id. Do not union them as independent clubs.
begin transaction isolation level repeatable read read only;

select basketball_type, country, league_name,
       count(*) filter (where active is true) as active_directory_rows,
       count(*) filter (where active is true and source = 'womens_teams_mirror') as active_mirror_rows
from public.teams
group by 1,2,3
order by 1,2,3;

-- Candidate generation only: punctuation/spacing matches can be different clubs.
-- Keep city, source, competition and exact ids for manual review. Never conflate sides.
with normalized as (
  select id, name, country, city, league_name, basketball_type, source,
         lower(regexp_replace(btrim(name), '[[:space:][:punct:]]+', '', 'g')) as name_key
  from public.teams
  where active is true and basketball_type in ('mens','womens')
    and nullif(btrim(country),'') is not null
), candidates as (
  select basketball_type, country, name_key, count(*) as row_count,
         jsonb_agg(jsonb_build_object('id',id,'name',name,'city',city,
             'league',league_name,'source',source) order by id) as review_rows
  from normalized where nullif(name_key,'') is not null
  group by 1,2,3 having count(*) > 1
)
select * from candidates order by basketball_type,country,name_key;

-- Same-id mirror integrity, not duplicate detection. Null-safe side and active checks.
select w.id, w.name, w.country, t.id as mirror_id, t.basketball_type, t.source,
       case when t.id is null then 'missing_mirror'
            when t.basketball_type is distinct from 'womens' then 'wrong_side'
            when t.source is distinct from 'womens_teams_mirror' then 'source_needs_review'
            when t.active is distinct from w.active then 'active_mismatch'
            when t.country is distinct from w.country or t.name is distinct from w.name then 'identity_mismatch'
            else 'linked' end as review_status
from public.womens_teams w left join public.teams t on t.id=w.id
order by w.id;

select t.id,t.name,t.country,t.active
from public.teams t left join public.womens_teams w on w.id=t.id
where t.source='womens_teams_mirror' and w.id is null
order by t.id;

-- Inventory real FK dependencies before even proposing a canonical-id merge.
-- Also review non-FK text/JSON references separately; this list is not exhaustive.
select conrelid::regclass::text as referencing_table,
       confrelid::regclass::text as referenced_table,
       conname, pg_get_constraintdef(oid) as constraint_definition
from pg_constraint
where contype='f' and confrelid in ('public.teams'::regclass,'public.womens_teams'::regclass)
order by 1,2,3;

rollback;
