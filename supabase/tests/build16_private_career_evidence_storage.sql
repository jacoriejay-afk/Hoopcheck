\set ON_ERROR_STOP on
-- Disposable fixture only: reuse the claim/decision fixture, not hosted data.
\i supabase/tests/build16_player_season_claim_decisions.sql
create schema storage;
create table storage.buckets(id text primary key,name text not null,public boolean not null,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null references storage.buckets(id),name text not null);
alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;
grant usage on schema storage to anon,authenticated,service_role;
grant select,insert,update,delete on storage.buckets,storage.objects to anon,authenticated,service_role;
-- Simulate broad permissive legacy policy to verify restrictive isolation.
create policy fixture_buckets on storage.buckets for all to anon,authenticated using (true) with check (true);
create policy fixture_objects on storage.objects for all to anon,authenticated using (true) with check (true);
insert into storage.buckets values ('unrelated','unrelated',false,null,null);
\i supabase/candidates/build16_private_career_evidence_storage_review_only.sql
insert into storage.objects(bucket_id,name) values ('career-verification-evidence','private.pdf'),('unrelated','other.pdf');
insert into public.player_season_claim_documents(evidence_id,claim_id,evidence_kind,byte_size,sha256,expires_at)
values ('cccccccc-cccc-cccc-cccc-ccccccccccc2','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','contract',1024,repeat('a',64),now()+interval '30 days');
do $$ begin
 if not exists(select 1 from public.player_season_claim_documents where object_path='cccccccc-cccc-cccc-cccc-ccccccccccc2.pdf' and scan_status='quarantined') then raise exception 'private generated path or quarantine missing'; end if;
 if (select public from storage.buckets where id='career-verification-evidence') then raise exception 'bucket public'; end if;
 begin
 insert into public.player_season_claim_documents(evidence_id,claim_id,evidence_kind,byte_size,sha256,expires_at)
 values ('cccccccc-cccc-cccc-cccc-ccccccccccc1','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','contract',100,repeat('b',64),now()+interval '30 days');
 raise exception 'cross claim attachment accepted'; exception when foreign_key_violation then null; end;
 begin
 insert into public.player_season_claim_documents(evidence_id,claim_id,evidence_kind,byte_size,sha256,expires_at)
 values ('cccccccc-cccc-cccc-cccc-ccccccccccc1','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2','contract',4194305,repeat('b',64),now()+interval '30 days');
 raise exception 'oversized attachment accepted'; exception when check_violation then null; end;
end $$;
set role authenticated;
do $$ begin
 if exists(select 1 from storage.objects where bucket_id='career-verification-evidence') then raise exception 'private objects leaked'; end if;
 if exists(select 1 from storage.buckets where id='career-verification-evidence') then raise exception 'private bucket leaked'; end if;
 if not exists(select 1 from storage.objects where bucket_id='unrelated') then raise exception 'unrelated bucket broken'; end if;
 begin
 insert into storage.objects(bucket_id,name) values ('career-verification-evidence','forged.pdf');
 raise exception 'direct upload accepted'; exception when insufficient_privilege then null; end;
 begin
 update storage.objects set bucket_id='career-verification-evidence' where bucket_id='unrelated';
 raise exception 'direct move accepted'; exception when insufficient_privilege then null; end;
 if has_table_privilege('authenticated','public.player_season_claim_documents','SELECT') or has_table_privilege('authenticated','public.player_season_claim_documents','INSERT') then raise exception 'metadata exposed'; end if;
end $$;
reset role;
set role anon;
do $$ begin
 if exists(select 1 from storage.objects where bucket_id='career-verification-evidence') then raise exception 'anonymous object leak'; end if;
 if has_table_privilege('anon','public.player_season_claim_documents','SELECT') then raise exception 'anonymous metadata leak'; end if;
end $$;
reset role;
set role service_role;
do $$ begin
 if not exists(select 1 from public.player_season_claim_documents) then raise exception 'server cannot read registry'; end if;
 if not has_column_privilege('service_role','public.player_season_claim_documents','scan_status','UPDATE') or has_column_privilege('service_role','public.player_season_claim_documents','claim_id','UPDATE') then raise exception 'server metadata mutation scope incorrect'; end if;
end $$;
reset role;

-- New acceptance guard, installed after the legacy metadata fixtures.
\\i supabase/candidates/build16_private_career_evidence_scan_guard_review_only.sql
insert into public.player_team_season_claims(id,player_id,team_id,season_start_year,season_end_year) values
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3','22222222-2222-2222-2222-222222222222','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',2023,2024),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4','22222222-2222-2222-2222-222222222222','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',2024,2025);
insert into public.player_season_claim_evidence(id,claim_id,evidence_kind) values
 ('cccccccc-cccc-cccc-cccc-ccccccccccc3','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3','contract'),
 ('cccccccc-cccc-cccc-cccc-ccccccccccc4','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4','official_roster');
insert into public.player_season_claim_documents(evidence_id,claim_id,evidence_kind,byte_size,sha256,expires_at)
 values ('cccccccc-cccc-cccc-cccc-ccccccccccc3','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3','contract',100,repeat('c',64),now()+interval '30 days');
set role service_role;
do $$ begin
 begin
  update public.player_season_claim_evidence set intake_status='accepted',accepted_at=now() where id='cccccccc-cccc-cccc-cccc-ccccccccccc3';
  raise exception 'quarantined contract accepted'; exception when invalid_parameter_value then null; end;
 begin
  update public.player_season_claim_evidence set intake_status='accepted',accepted_at=now() where id='cccccccc-cccc-cccc-cccc-ccccccccccc4';
  raise exception 'missing roster accepted'; exception when invalid_parameter_value then null; end;
 update public.player_season_claim_documents set scan_status='clean' where evidence_id='cccccccc-cccc-cccc-cccc-ccccccccccc3';
 update public.player_season_claim_evidence set intake_status='accepted',accepted_at=now() where id='cccccccc-cccc-cccc-cccc-ccccccccccc3';
 update public.player_season_claim_documents set scan_status='rejected' where evidence_id='cccccccc-cccc-cccc-cccc-ccccccccccc3';
end $$;
reset role;
set role authenticated;
do $$ begin
 perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
 begin
  perform public.decide_player_season_claim('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3','verified','Fixture','contract','cccccccc-cccc-cccc-cccc-ccccccccccc3');
  raise exception 'subsequently rejected scan verified'; exception when invalid_parameter_value then null; end;
end $$;
reset role;
-- A clean scan is required at the decision point too.
update public.player_season_claim_documents set scan_status='clean' where evidence_id='cccccccc-cccc-cccc-cccc-ccccccccccc3';
set role authenticated;
do $$ begin
 perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
 if public.decide_player_season_claim('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3','verified','Fixture','contract','cccccccc-cccc-cccc-cccc-ccccccccccc3')<>'verified' then raise exception 'clean evidence verification failed'; end if;
end $$;
reset role;
-- Expired document cannot be accepted even when scan is clean.
insert into public.player_season_claim_documents(evidence_id,claim_id,evidence_kind,byte_size,sha256,scan_status,created_at,expires_at)
 values ('cccccccc-cccc-cccc-cccc-ccccccccccc4','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4','official_roster',100,repeat('d',64),'clean',now()-interval '2 days',now()-interval '1 day');
do $$ begin
 begin
  update public.player_season_claim_evidence set intake_status='accepted',accepted_at=now() where id='cccccccc-cccc-cccc-cccc-ccccccccccc4';
  raise exception 'expired roster accepted'; exception when invalid_parameter_value then null; end;
 if (select verification_status from public.player_team_season_claims where id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4')<>'pending' then raise exception 'failed decision changed claim'; end if;
end $$;
