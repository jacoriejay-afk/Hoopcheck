-- REVIEW ONLY #1049. Apply after private career evidence storage candidate
-- in an isolated disposable database, never to hosted data.
begin;
-- Document-backed evidence cannot be accepted or used to verify a claim unless
-- its exact opaque registry entry has been scanned clean and is unexpired.
-- No raw document contents, object path, identity or scan result is public.
create function public.guard_career_document_acceptance() returns trigger
language plpgsql security invoker set search_path=pg_catalog as $$
begin
 if new.evidence_kind in ('contract','official_roster') and new.intake_status='accepted' then
   perform 1 from public.player_season_claim_documents d
    where d.evidence_id=new.id and d.claim_id=new.claim_id and d.evidence_kind=new.evidence_kind
      and d.scan_status='clean' and d.expires_at>clock_timestamp()
    for share;
   if not found then raise exception 'Clean unexpired claim document required' using errcode='22023'; end if;
 end if;
 return new;
end $$;
revoke all on function public.guard_career_document_acceptance() from public,anon,authenticated;
create trigger career_document_acceptance_guard
 before insert or update on public.player_season_claim_evidence
 for each row execute function public.guard_career_document_acceptance();

-- Recheck at the atomic decision boundary, including metadata accepted before
-- the guard, or a document that expired or was subsequently quarantined.
create function public.guard_career_document_decision() returns trigger
language plpgsql security invoker set search_path=pg_catalog as $$
begin
 if new.decision='verified' and new.evidence_kind in ('contract','official_roster') then
   perform 1 from public.player_season_claim_documents d
    where d.evidence_id=new.evidence_reference and d.claim_id=new.claim_id and d.evidence_kind=new.evidence_kind
      and d.scan_status='clean' and d.expires_at>clock_timestamp()
    for share;
   if not found then raise exception 'Clean unexpired claim document required' using errcode='22023'; end if;
 end if;
 return new;
end $$;
revoke all on function public.guard_career_document_decision() from public,anon,authenticated;
create trigger career_document_decision_guard before insert on public.player_season_claim_decisions
 for each row execute function public.guard_career_document_decision();
-- This guard is not a scanner, object existence check, staff-access audit,
-- retention worker, or retroactive revocation procedure. A trusted scan
-- pipeline and reconciliation of previously accepted evidence are rollout gates.
commit;
