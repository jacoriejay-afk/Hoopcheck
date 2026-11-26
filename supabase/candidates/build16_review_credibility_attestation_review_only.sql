-- REVIEW ONLY #1049. Apply after exact-season guard in disposable DB only.
-- Never backfill legacy reviews. No client access to claim linkage.
begin;
create table public.review_season_attestations (
 id uuid primary key default gen_random_uuid(),
 review_id uuid unique references public.reviews(id) on delete cascade,
 womens_review_id uuid unique references public.womens_team_reviews(id) on delete cascade,
 claim_id uuid not null references public.player_team_season_claims(id) on delete restrict,
 created_at timestamptz not null default now(),
 check(num_nonnulls(review_id,womens_review_id)=1)
);
alter table public.review_season_attestations enable row level security;
revoke all on public.review_season_attestations from public,anon,authenticated,service_role;
grant select on public.review_season_attestations to service_role;

-- Trusted trigger only; writes are not exposed as a client-callable RPC.
create function private.attest_exact_review_season() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare v_claim uuid; v_team uuid; v_womens uuid;
begin
 if auth.uid() is null or auth.uid()<>new.author_id or new.status<>'pending' then return new; end if;
 if tg_table_schema<>'public' then return new; end if;
 if tg_table_name='reviews' then
  v_team:=new.team_id;
  if v_team is null or new.coach_id is not null or new.league_id is not null then return new; end if;
 elsif tg_table_name='womens_team_reviews' then v_womens:=new.womens_team_id;
 else return new; end if;
 select c.id into v_claim from public.player_team_season_claims c
 where c.player_id=new.author_id and c.verification_status='verified'
   and c.team_id is not distinct from v_team and c.womens_team_id is not distinct from v_womens
   and new.player_season=case when c.season_start_year=c.season_end_year then c.season_start_year::text
     else c.season_start_year::text||'-'||c.season_end_year::text end
 for share;
 if found then
  if tg_table_name='reviews' then insert into public.review_season_attestations(review_id,claim_id) values(new.id,v_claim);
  else insert into public.review_season_attestations(womens_review_id,claim_id) values(new.id,v_claim); end if;
 end if;
 return new;
end $$;
revoke all on function private.attest_exact_review_season() from public,anon,authenticated,service_role;
create trigger attest_team_review_season after insert on public.reviews
for each row execute function private.attest_exact_review_season();
create trigger attest_womens_review_season after insert on public.womens_team_reviews
for each row execute function private.attest_exact_review_season();

-- Server-only projection for future entitlement-gated review API. No author,
-- claim ID, season, dates, evidence or staff information. Recheck current claim
-- scope on each read, never label legacy, pending or revoked reviews.
create view public.approved_review_season_attestations with (security_invoker=true) as
 select r.id as review_id,'team'::text as directory
 from public.review_season_attestations a join public.reviews r on r.id=a.review_id
 join public.player_team_season_claims c on c.id=a.claim_id
 where r.status='approved' and c.verification_status='verified' and c.player_id=r.author_id
 and c.team_id=r.team_id and r.coach_id is null and r.league_id is null
 and r.player_season=case when c.season_start_year=c.season_end_year then c.season_start_year::text else c.season_start_year::text||'-'||c.season_end_year::text end
 union all
 select r.id,'womens-team'::text
 from public.review_season_attestations a join public.womens_team_reviews r on r.id=a.womens_review_id
 join public.player_team_season_claims c on c.id=a.claim_id
 where r.status='approved' and c.verification_status='verified' and c.player_id=r.author_id
 and c.womens_team_id=r.womens_team_id
 and r.player_season=case when c.season_start_year=c.season_end_year then c.season_start_year::text else c.season_start_year::text||'-'||c.season_end_year::text end;
revoke all on public.approved_review_season_attestations from public,anon,authenticated,service_role;
grant select on public.approved_review_season_attestations to service_role;
-- Actual UI/API, anonymous inference review, full schema policy rehearsal and
-- claim lifecycle reconciliation must be separately accepted before rollout.
commit;
