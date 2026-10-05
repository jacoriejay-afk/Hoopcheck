-- Audit trail for admin/moderator review and report status changes.
create table if not exists public.review_moderation_events (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references public.reviews(id) on delete cascade,
  report_id uuid references public.review_reports(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  entity_type text not null check (entity_type in ('review','report')),
  from_status text,
  to_status text not null,
  created_at timestamptz not null default now(),
  check (
    (entity_type = 'review' and review_id is not null and report_id is null)
    or
    (entity_type = 'report' and report_id is not null and review_id is null)
  )
);

create index if not exists review_moderation_events_review_idx
  on public.review_moderation_events(review_id, created_at desc);
create index if not exists review_moderation_events_report_idx
  on public.review_moderation_events(report_id, created_at desc);

alter table public.review_moderation_events enable row level security;

drop policy if exists "moderators can read moderation events" on public.review_moderation_events;
create policy "moderators can read moderation events"
  on public.review_moderation_events
  for select
  to authenticated
  using (public.is_current_user_admin_or_moderator());

drop policy if exists "moderators can insert moderation events" on public.review_moderation_events;
create policy "moderators can insert moderation events"
  on public.review_moderation_events
  for insert
  to authenticated
  with check (public.is_current_user_admin_or_moderator());

revoke all on public.review_moderation_events from anon;
grant select, insert on public.review_moderation_events to authenticated;
