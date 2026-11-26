-- REVIEW ONLY. Do not apply to a hosted database.
-- Private, revocable consent to discuss basketball experience, not an endorsement.
begin;
create schema if not exists private;
create table private.player_reference_requests (
 connection_id uuid primary key references public.player_contact_requests(id) on delete cascade,
 requester_id uuid not null references public.profiles(id) on delete cascade,
 reference_id uuid not null references public.profiles(id) on delete cascade,
 state text not null default 'pending' check (state in ('pending','accepted','declined','revoked')),
 created_at timestamptz not null default now(),
 changed_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '30 days'),
 check (requester_id <> reference_id),
 check (expires_at > created_at)
);
create index player_reference_requester_time on private.player_reference_requests(requester_id,created_at);
create index player_reference_reference_idx on private.player_reference_requests(reference_id);
alter table private.player_reference_requests enable row level security;
revoke all on private.player_reference_requests from public,anon,authenticated,service_role;

-- This narrowly scoped function needs to see both participants' verification
-- and both directions of the block list. No identity, notes or raw rows returned.
create function private.player_reference_action(p_connection_id uuid,p_action text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 actor uuid:=auth.uid();
 c public.player_contact_requests%rowtype;
 r private.player_reference_requests%rowtype;
 effective_state text;
 current_time timestamptz:=pg_catalog.now();
begin
 if actor is null or p_connection_id is null or p_action is null
    or p_action not in ('read','request','accept','decline','revoke') then
  raise exception 'Reference unavailable' using errcode='42501';
 end if;
 select * into c from public.player_contact_requests
  where id=p_connection_id and (requester_id=actor or player_id=actor);
 if c.id is null or c.requester_id=c.player_id then
  raise exception 'Reference unavailable' using errcode='42501';
 end if;
 -- A participant can revoke even after blocking or connection closure; no
 -- private details are returned to an actor who is no longer eligible.
 if p_action='revoke' then
  update private.player_reference_requests set state='revoked',changed_at=current_time
   where connection_id=c.id and (requester_id=actor or reference_id=actor)
     and state in ('pending','accepted') and expires_at>current_time;
  return pg_catalog.jsonb_build_object('state','revoked','canRequest',false,'canRespond',false,'canRevoke',false);
 end if;
 if c.status<>'accepted'
    or not exists(select 1 from public.profiles where id=c.requester_id and account_type='player' and player_verified=true and moderation_status<>'suspended')
    or not exists(select 1 from public.profiles where id=c.player_id and account_type='player' and player_verified=true and moderation_status<>'suspended')
    or exists(select 1 from public.user_blocks b where
      (b.blocker_id=c.requester_id and b.blocked_id=c.player_id) or
      (b.blocker_id=c.player_id and b.blocked_id=c.requester_id)) then
  raise exception 'Reference unavailable' using errcode='42501';
 end if;
 if p_action='request' then
  if actor<>c.requester_id then raise exception 'Reference unavailable' using errcode='42501';end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hoopcheck-reference:'||actor::text,0));
  if (select count(*) from private.player_reference_requests where requester_id=actor and created_at>=current_time-interval '24 hours')>=3 then
   raise exception 'Reference request limit reached' using errcode='P0001';
  end if;
  insert into private.player_reference_requests(connection_id,requester_id,reference_id)
   values(c.id,c.requester_id,c.player_id) on conflict(connection_id) do nothing;
 elsif p_action in ('accept','decline') then
  if actor<>c.player_id then raise exception 'Reference unavailable' using errcode='42501';end if;
  update private.player_reference_requests set state=case when p_action='accept' then 'accepted' else 'declined' end,changed_at=current_time
   where connection_id=c.id and reference_id=actor and state='pending' and expires_at>current_time;
  if not found then raise exception 'Reference no longer pending' using errcode='42501';end if;
 end if;
 select * into r from private.player_reference_requests where connection_id=c.id
    and requester_id=c.requester_id and reference_id=c.player_id;
 effective_state:=case when r.connection_id is null then 'none'
     when r.expires_at<=current_time then 'expired' else r.state end;
 return pg_catalog.jsonb_build_object(
   'state',effective_state,
   'canRequest',effective_state='none' and actor=c.requester_id,
   'canRespond',effective_state='pending' and actor=c.player_id,
   'canRevoke',effective_state in ('pending','accepted'));
end;
$$;
revoke all on function private.player_reference_action(uuid,text) from public,anon,authenticated,service_role;
grant usage on schema private to authenticated;
grant execute on function private.player_reference_action(uuid,text) to authenticated;
create function public.player_reference_action(p_connection_id uuid,p_action text)
returns jsonb language sql security invoker set search_path = '' as $$
 select private.player_reference_action(p_connection_id,p_action);
$$;
revoke all on function public.player_reference_action(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.player_reference_action(uuid,text) to authenticated;
commit;
