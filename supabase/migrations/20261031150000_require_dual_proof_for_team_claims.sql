-- Team claims must provide two independent forms of evidence.
-- Coach profile claims retain the existing email-or-document pathway.
alter table public.profile_claim_requests
  drop constraint if exists profile_claim_team_dual_proof_check;

alter table public.profile_claim_requests
  add constraint profile_claim_team_dual_proof_check
  check (
    entity_type <> 'team'
    or (
      organization_email is not null
      and length(trim(organization_email)) > 3
      and proof_document_path is not null
      and length(trim(proof_document_path)) > 0
    )
  );
