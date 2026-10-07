-- Founder launch foundations: support, moderation/legal risk controls, analytics, and account activity.
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.profiles add column if not exists experience_goal text;
alter table public.profiles add column if not exists research_preferences text;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 160),
  category text not null default 'general' check (category in ('account','billing','verification','review','privacy','security','technical','team_request','general')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','in_progress','waiting_on_user','resolved','closed')),
  description text not null check (char_length(description) between 10 and 5000),
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;
drop policy if exists "ticket owner read" on public.support_tickets;
create policy "ticket owner read" on public.support_tickets for select to authenticated using (requester_id=(select auth.uid()) or public.is_current_user_admin_or_moderator());
drop policy if exists "ticket owner create" on public.support_tickets;
create policy "ticket owner create" on public.support_tickets for insert to authenticated with check (requester_id=(select auth.uid()));
drop policy if exists "ticket owner update" on public.support_tickets;
create policy "ticket owner update" on public.support_tickets for update to authenticated using (requester_id=(select auth.uid()) or public.is_current_user_admin_or_moderator()) with check (requester_id=(select auth.uid()) or public.is_current_user_admin_or_moderator());
drop policy if exists "ticket messages read" on public.support_ticket_messages;
create policy "ticket messages read" on public.support_ticket_messages for select to authenticated using (exists (select 1 from public.support_tickets t where t.id=ticket_id and (t.requester_id=(select auth.uid()) or public.is_current_user_admin_or_moderator())));
drop policy if exists "ticket messages create" on public.support_ticket_messages;
create policy "ticket messages create" on public.support_ticket_messages for insert to authenticated with check (author_id=(select auth.uid()) and exists (select 1 from public.support_tickets t where t.id=ticket_id and (t.requester_id=(select auth.uid()) or public.is_current_user_admin_or_moderator())));
create index if not exists support_tickets_requester_idx on public.support_tickets(requester_id,created_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets(status,updated_at desc);

create table if not exists public.moderation_risk_flags (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('review','feed_post','profile')),
  content_id uuid not null,
  risk_type text not null check (risk_type in ('defamation','harassment','privacy','threat','impersonation','copyright','other')),
  matched_term text,
  status text not null default 'open' check (status in ('open','cleared','actioned')),
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewer_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table public.moderation_risk_flags enable row level security;
drop policy if exists "moderation risk admin read" on public.moderation_risk_flags;
create policy "moderation risk admin read" on public.moderation_risk_flags for select to authenticated using (public.is_current_user_admin_or_moderator());
drop policy if exists "moderation risk admin update" on public.moderation_risk_flags;
create policy "moderation risk admin update" on public.moderation_risk_flags for update to authenticated using (public.is_current_user_admin_or_moderator()) with check (public.is_current_user_admin_or_moderator());
alter table public.reviews add column if not exists legal_review_required boolean not null default false;

create or replace function public.flag_review_legal_risk() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare combined text := lower(coalesce(new.title,'') || ' ' || coalesce(new.body,'')); term text;
begin
  foreach term in array array['scam','fraud','stole','stolen','theft','embezz','criminal','crime','illegal','corrupt','bribe','racist','sex offender','sexual assault','assaulted','abuse','abused','liar','cheated','cheater'] loop
    if combined like '%' || term || '%' then
      new.legal_review_required := true;
      insert into public.moderation_risk_flags(content_type,content_id,risk_type,matched_term) values ('review',new.id,'defamation',term);
      exit;
    end if;
  end loop;
  return new;
end; $$;
revoke all on function public.flag_review_legal_risk() from public;
drop trigger if exists reviews_legal_risk_trigger on public.reviews;
create trigger reviews_legal_risk_trigger before insert or update of title,body on public.reviews for each row execute function public.flag_review_legal_risk();

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.analytics_events enable row level security;
drop policy if exists "analytics own insert" on public.analytics_events;
create policy "analytics own insert" on public.analytics_events for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists "analytics admin read" on public.analytics_events;
create policy "analytics admin read" on public.analytics_events for select to authenticated using (public.is_current_user_admin_or_moderator());
create index if not exists analytics_events_name_time_idx on public.analytics_events(event_name,created_at desc);
create index if not exists analytics_events_user_time_idx on public.analytics_events(user_id,created_at desc);

create or replace function public.touch_last_seen() returns void language sql security invoker set search_path = public as $$
  update public.profiles set last_seen_at=now(), updated_at=now() where id=(select auth.uid());
$$;
grant execute on function public.touch_last_seen() to authenticated;

create or replace function public.get_hoopcheck_kpis() returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  if not public.is_current_user_admin_or_moderator() then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'users_total',(select count(*) from public.profiles),
    'players_total',(select count(*) from public.profiles where account_type='player'),
    'verified_players',(select count(*) from public.profiles where account_type='player' and player_verified=true),
    'paying_users',(select count(*) from public.subscriptions where status in ('active','trialing') and plan in ('pro','premium')),
    'pro_users',(select count(*) from public.subscriptions where status in ('active','trialing') and plan='pro'),
    'premium_users',(select count(*) from public.subscriptions where status in ('active','trialing') and plan='premium'),
    'reviews_total',(select count(*) from public.reviews),
    'reviews_pending',(select count(*) from public.reviews where status='pending'),
    'reviews_legal_review',(select count(*) from public.reviews where legal_review_required=true and status in ('pending','flagged')),
    'teams_active',(select count(*) from public.teams where active=true),
    'leagues_active',(select count(*) from public.leagues where active=true),
    'feed_posts_24h',(select count(*) from public.feed_posts where expires_at > now()),
    'open_tickets',(select count(*) from public.support_tickets where status in ('open','in_progress','waiting_on_user')),
    'active_users_7d',(select count(*) from public.profiles where last_seen_at >= now()-interval '7 days'),
    'new_users_7d',(select count(*) from public.profiles where created_at >= now()-interval '7 days'),
    'new_reviews_7d',(select count(*) from public.reviews where created_at >= now()-interval '7 days')
  ) into result;
  return result;
end; $$;
revoke all on function public.get_hoopcheck_kpis() from public;
grant execute on function public.get_hoopcheck_kpis() to authenticated;
