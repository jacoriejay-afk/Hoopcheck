-- Account types, secure player verification documents, and team-directory indexes.
alter table public.profiles add column if not exists account_type text not null default 'player' check (account_type in ('player','scout','agent','fan'));
alter table public.player_verification_requests add column if not exists document_type text check (document_type in ('passport','basketball_license','national_id','other'));
alter table public.player_verification_requests add column if not exists document_path text;
alter table public.player_verification_requests add column if not exists document_uploaded_at timestamptz;
create index if not exists idx_teams_league_id_active on public.teams(league_id) where active=true;
create index if not exists idx_teams_country_active on public.teams(country) where active=true;
insert into storage.buckets (id,name,public) values ('player-verification-documents','player-verification-documents',false) on conflict (id) do nothing;
drop policy if exists "Users upload own verification documents" on storage.objects;
create policy "Users upload own verification documents" on storage.objects for insert to authenticated with check (bucket_id='player-verification-documents' and (storage.foldername(name))[1]=(select auth.uid()::text));
drop policy if exists "Users view own verification documents" on storage.objects;
create policy "Users view own verification documents" on storage.objects for select to authenticated using (bucket_id='player-verification-documents' and ((storage.foldername(name))[1]=(select auth.uid()::text) or public.is_current_user_admin_or_moderator()));
drop policy if exists "Users update own verification documents" on storage.objects;
create policy "Users update own verification documents" on storage.objects for update to authenticated using (bucket_id='player-verification-documents' and (storage.foldername(name))[1]=(select auth.uid()::text)) with check (bucket_id='player-verification-documents' and (storage.foldername(name))[1]=(select auth.uid()::text));
drop policy if exists "Users delete own verification documents" on storage.objects;
create policy "Users delete own verification documents" on storage.objects for delete to authenticated using (bucket_id='player-verification-documents' and ((storage.foldername(name))[1]=(select auth.uid()::text) or public.is_current_user_admin_or_moderator()));