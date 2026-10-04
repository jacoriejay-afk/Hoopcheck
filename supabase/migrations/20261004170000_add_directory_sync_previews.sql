-- Approval-based directory sync previews
create table if not exists public.directory_sync_previews (
 id uuid primary key default gen_random_uuid(),
 source_id uuid not null references public.directory_sources(id) on delete cascade,
 created_by uuid not null references auth.users(id) on delete cascade,
 entity_type text not null check (entity_type in ('leagues','teams','coaches')),
 status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
 normalized_data jsonb not null,
 total_rows integer not null default 0,
 create_count integer not null default 0,
 update_count integer not null default 0,
 skip_count integer not null default 0,
 expires_at timestamptz not null default (now() + interval '30 minutes'),
 created_at timestamptz not null default now(),
 approved_at timestamptz
);
alter table public.directory_sync_previews enable row level security;
create policy "directory_sync_previews_admin_read" on public.directory_sync_previews for select to authenticated using (public.is_current_user_admin_or_moderator());
create policy "directory_sync_previews_admin_insert" on public.directory_sync_previews for insert to authenticated with check (public.is_current_user_admin_or_moderator() and created_by=(select auth.uid()));
create policy "directory_sync_previews_admin_update" on public.directory_sync_previews for update to authenticated using (public.is_current_user_admin_or_moderator()) with check (public.is_current_user_admin_or_moderator());
create index if not exists directory_sync_previews_lookup_idx on public.directory_sync_previews(source_id,entity_type,status,created_at desc);
