-- Trust and safety: unified content reports and user blocks.
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('review','hoopfeed_post','chat_message')),
  content_id uuid not null,
  reporter_id uuid not null references auth.users(id) on delete set null,
  content_owner_id uuid references auth.users(id) on delete set null,
  content_snapshot text not null default '',
  reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);
create index if not exists content_reports_queue_idx on public.content_reports(status, created_at desc);
create index if not exists content_reports_content_idx on public.content_reports(content_type, content_id);
alter table public.content_reports enable row level security;
drop policy if exists content_reports_admin_select on public.content_reports;
create policy content_reports_admin_select on public.content_reports for select to authenticated using (public.is_current_user_admin_or_moderator());
drop policy if exists content_reports_admin_update on public.content_reports;
create policy content_reports_admin_update on public.content_reports for update to authenticated using (public.is_current_user_admin_or_moderator()) with check (public.is_current_user_admin_or_moderator());
revoke all on public.content_reports from anon, authenticated;
grant select, update on public.content_reports to authenticated;
grant all on public.content_reports to service_role;

create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_blocks_not_self check (blocker_id <> blocked_id),
  constraint user_blocks_unique unique (blocker_id, blocked_id)
);
create index if not exists user_blocks_blocked_idx on public.user_blocks(blocked_id);
alter table public.user_blocks enable row level security;
drop policy if exists user_blocks_select_own on public.user_blocks;
create policy user_blocks_select_own on public.user_blocks for select to authenticated using ((select auth.uid()) = blocker_id);
drop policy if exists user_blocks_insert_own on public.user_blocks;
create policy user_blocks_insert_own on public.user_blocks for insert to authenticated with check ((select auth.uid()) = blocker_id and blocker_id <> blocked_id);
drop policy if exists user_blocks_delete_own on public.user_blocks;
create policy user_blocks_delete_own on public.user_blocks for delete to authenticated using ((select auth.uid()) = blocker_id);
grant select, insert, delete on public.user_blocks to authenticated;

create or replace function public.is_blocked_between_users(p_other_user uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_blocks b where
    (b.blocker_id = (select auth.uid()) and b.blocked_id = p_other_user) or
    (b.blocker_id = p_other_user and b.blocked_id = (select auth.uid()));
$$;
revoke all on function public.is_blocked_between_users(uuid) from public, anon;
grant execute on function public.is_blocked_between_users(uuid) to authenticated;
