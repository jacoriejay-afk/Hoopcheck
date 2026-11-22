-- PHASE5-SAFETY-1. Additive, service-only Reel moderation with an audit trail.
-- Preserve all existing feed, media, account, and subscription RLS policies.
-- The server route must first validate the actual moderator's Supabase JWT
-- and existing is_current_user_admin_or_moderator() authorization.
create table if not exists public.reel_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid references public.feed_posts(id) on delete set null,
  support_ticket_id uuid references public.support_tickets(id) on delete set null,
  moderator_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('hide')),
  from_status text not null,
  reason text not null check (char_length(btrim(reason)) between 25 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists reel_moderation_actions_reel_created_idx
  on public.reel_moderation_actions(reel_id, created_at desc);
alter table public.reel_moderation_actions enable row level security;
revoke all on public.reel_moderation_actions from public, anon, authenticated;
grant select, insert on public.reel_moderation_actions to service_role;

-- Atomic fail-closed transition: no anonymous caller can change or approve
-- video content. Security INVOKER means the function never escalates rights.
create or replace function public.hide_approved_reel_for_moderation(
  p_reel_id uuid, p_moderator_id uuid, p_reason text, p_support_ticket_id uuid default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare old_status text;
begin
  if p_reel_id is null or p_moderator_id is null or
     p_reason is null or char_length(btrim(p_reason)) not between 25 and 1000
  then
    raise exception 'Invalid moderation request';
  end if;
  -- The server verified this JWT actor with auth.getUser; the FK on
  -- moderation_actions.moderator_id checks existence without granting
  -- service_role direct SELECT on protected auth.users.
  if p_support_ticket_id is not null and not exists (
    select 1 from public.support_tickets t
    where t.id = p_support_ticket_id and t.category = 'security'
      and t.subject = 'Report a HoopFeed Reel'
  ) then
    raise exception 'Reel report ticket not found';
  end if;
  update public.feed_posts f set status = 'rejected'
  where f.id = p_reel_id and f.status = 'approved' and f.video_url is not null
  returning 'approved' into old_status;
  if not found then return false; end if;
  insert into public.reel_moderation_actions
    (reel_id, support_ticket_id, moderator_id, action, from_status, reason)
  values (p_reel_id, p_support_ticket_id, p_moderator_id, 'hide', old_status, btrim(p_reason));
  return true;
end;
$$;
revoke all on function public.hide_approved_reel_for_moderation(uuid,uuid,text,uuid)
  from public, anon, authenticated;
grant execute on function public.hide_approved_reel_for_moderation(uuid,uuid,text,uuid)
  to service_role;
comment on function public.hide_approved_reel_for_moderation(uuid,uuid,text,uuid)
  is 'Service-role only; caller must verify moderator authorization. Atomically unpublishes an approved video and writes an audit row.';
