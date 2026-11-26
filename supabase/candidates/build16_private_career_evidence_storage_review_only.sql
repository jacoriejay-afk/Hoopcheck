-- REVIEW ONLY #1049: private storage boundary, not a migration or upload service.
-- Requires claims and claim decisions candidates. Never execute against hosted data.
begin;
-- A new dedicated bucket; fail if the identifier is already used.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('career-verification-evidence','career-verification-evidence',false,4194304,array['application/pdf']);
-- Restrictive policies also block permissive legacy policies on other buckets.
-- Access must go through a future server-only, claim-scoped, audited intake.
create policy "career evidence objects server only" on storage.objects
 as restrictive for all to anon,authenticated
 using (bucket_id <> 'career-verification-evidence')
 with check (bucket_id <> 'career-verification-evidence');
create policy "career evidence bucket server only" on storage.buckets
 as restrictive for all to anon,authenticated
 using (id <> 'career-verification-evidence')
 with check (id <> 'career-verification-evidence');

create table public.player_season_claim_documents (
 id uuid primary key default gen_random_uuid(),
 evidence_id uuid not null unique,
 claim_id uuid not null,
 evidence_kind text not null check(evidence_kind in ('contract','official_roster')),
 foreign key(evidence_id,claim_id,evidence_kind)
   references public.player_season_claim_evidence(id,claim_id,evidence_kind) on delete restrict,
 -- Opaque generated path, no original file name or user details.
 object_path text generated always as (evidence_id::text || '.pdf') stored unique,
 content_type text not null default 'application/pdf' check(content_type='application/pdf'),
 byte_size integer not null check(byte_size between 1 and 4194304),
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 scan_status text not null default 'quarantined' check(scan_status in ('quarantined','clean','rejected')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 check(expires_at > created_at and expires_at <= created_at + interval '90 days')
);
alter table public.player_season_claim_documents enable row level security;
revoke all on public.player_season_claim_documents from public,anon,authenticated;
grant select,insert on public.player_season_claim_documents to service_role;
grant update(scan_status) on public.player_season_claim_documents to service_role;
-- No client policy, direct download, public link, or automated approval.
-- Before activation: authenticated owner-bound upload proxy, actual PDF scan,
-- staff access audit, accepted evidence linkage, withdrawal/purge and retention
-- process, and real Storage API tests. Expiry metadata alone does not delete bytes.
commit;
