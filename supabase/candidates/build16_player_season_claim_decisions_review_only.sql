-- REVIEW ONLY #1049. Depends on player_team_season_claims candidate.
-- Never apply to hosted data. Keep owner approval boundary and separate identity
-- verification from team/season verification. Evidence files are not exposed.
begin;
-- Trusted intake metadata only; no public file URLs or raw documents.
create table public.player_season_claim_evidence (
 id uuid primary key default gen_random_uuid(),
 claim_id uuid not null references public.player_team_season_claims(id) on delete restrict,
 evidence_kind text not null check(evidence_kind in ('contract','official_roster','official_announcement','licensed_database')),
 intake_status text not null default 'pending' check(intake_status in ('pending','accepted','rejected','withdrawn')),
 accepted_at timestamptz,
 created_at timestamptz not null default now(),
 check((intake_status='accepted')=(accepted_at is not null)),
 unique(id,claim_id,evidence_kind)
);
alter table public.player_season_claim_evidence enable row level security;
revoke all on public.player_season_claim_evidence from public,anon,authenticated;
grant select,insert,update on public.player_season_claim_evidence to service_role;

create table public.player_season_claim_decisions (
 id uuid primary key default gen_random_uuid(),
 claim_id uuid not null references public.player_team_season_claims(id) on delete restrict,
 actor_id uuid not null references public.profiles(id) on delete restrict,
 previous_status text not null check(previous_status in ('pending','verified')),
 decision text not null check(decision in ('verified','rejected','revoked')),
 evidence_kind text check(evidence_kind in ('contract','official_roster','official_announcement','licensed_database')),
 -- Internal opaque reference, never a public URL or raw contract.
 evidence_reference uuid,
 reason text not null check(length(btrim(reason)) between 1 and 1000),
 decided_at timestamptz not null default now(),
 check((evidence_kind is null)=(evidence_reference is null)),
 foreign key(evidence_reference,claim_id,evidence_kind) references public.player_season_claim_evidence(id,claim_id,evidence_kind) on delete restrict,
 check(decision<>'verified' or (evidence_kind is not null and evidence_reference is not null))
);
alter table public.player_season_claim_decisions enable row level security;
revoke all on public.player_season_claim_decisions from public,anon,authenticated;
grant select on public.player_season_claim_decisions to service_role;

create function public.decide_player_season_claim(
 p_claim_id uuid, p_decision text, p_reason text,
 p_evidence_kind text default null, p_evidence_reference uuid default null
) returns text
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
 v_actor uuid := auth.uid();
 v_claim public.player_team_season_claims%rowtype;
begin
 if v_actor is null or not coalesce(hoopcheck_security.is_approved_owner(),false)
 or not exists(select 1 from public.admin_roles where user_id=v_actor and trim(lower(role))='admin')
 then raise exception 'Approved owner admin required' using errcode='42501'; end if;
 if p_decision is null or p_decision not in ('verified','rejected','revoked')
 or p_reason is null or length(btrim(p_reason)) not between 1 and 1000
 then raise exception 'Invalid career verification decision' using errcode='22023'; end if;
 if (p_evidence_kind is not null and p_evidence_kind not in ('contract','official_roster','official_announcement','licensed_database'))
 or ((p_evidence_kind is null) <> (p_evidence_reference is null))
 or (p_decision='verified' and p_evidence_reference is null)
 then raise exception 'Valid evidence reference required' using errcode='22023'; end if;
 select * into v_claim from public.player_team_season_claims where id=p_claim_id for update;
 if not found then raise exception 'Claim not found' using errcode='22023'; end if;
 if v_claim.player_id=v_actor then raise exception 'Cannot decide own claim' using errcode='42501'; end if;
 if not ((v_claim.verification_status='pending' and p_decision in ('verified','rejected'))
 or (v_claim.verification_status='verified' and p_decision='revoked'))
 then raise exception 'Invalid claim status transition' using errcode='22023'; end if;
 if p_evidence_reference is not null then
   perform 1 from public.player_season_claim_evidence e
   where e.id=p_evidence_reference and e.claim_id=v_claim.id
     and e.evidence_kind=p_evidence_kind
     and (p_decision<>'verified' or (e.intake_status='accepted' and e.accepted_at<=now()))
   for share;
   if not found then raise exception 'Evidence not eligible for this claim' using errcode='22023'; end if;
 end if;
 insert into public.player_season_claim_decisions(claim_id,actor_id,previous_status,decision,evidence_kind,evidence_reference,reason)
 values(v_claim.id,v_actor,v_claim.verification_status,p_decision,p_evidence_kind,p_evidence_reference,btrim(p_reason));
 update public.player_team_season_claims set verification_status=p_decision where id=v_claim.id;
 return p_decision;
end $$;
revoke all on function public.decide_player_season_claim(uuid,text,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.decide_player_season_claim(uuid,text,text,text,uuid) to authenticated;
-- Staff-only audit and evidence metadata. Before activation, implement secure
-- private storage/intake and validate actual content; metadata alone is not proof.
-- Review publication/revocation reconciliation remains separate.
commit;
