\set ON_ERROR_STOP on
-- Standalone synthetic actor matrix. Never use a hosted database.
do $$begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin;end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin;end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin;end if;
end$$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$;
create table auth.mfa_factors(user_id uuid not null,status text not null);
insert into auth.mfa_factors values('11111111-1111-4111-8111-111111111111','verified');
grant usage on schema auth to authenticated;
grant execute on function auth.uid(),auth.jwt() to authenticated;
create table public.profiles(id uuid primary key,account_type text not null,player_verified boolean not null,moderation_status text not null);
create table public.player_contact_requests(id uuid primary key,requester_id uuid references public.profiles(id),player_id uuid references public.profiles(id),status text not null);
create table public.user_blocks(blocker_id uuid,blocked_id uuid,primary key(blocker_id,blocked_id));
insert into public.profiles values
 ('11111111-1111-4111-8111-111111111111','player',true,'normal'),
 ('22222222-2222-4222-8222-222222222222','player',true,'normal'),
 ('33333333-3333-4333-8333-333333333333','player',true,'normal'),
 ('44444444-4444-4444-8444-444444444444','player',true,'normal'),
 ('55555555-5555-4555-8555-555555555555','player',true,'normal'),
 ('66666666-6666-4666-8666-666666666666','player',false,'normal');
insert into public.player_contact_requests values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','accepted'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','accepted'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444','accepted'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555','accepted'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5','11111111-1111-4111-8111-111111111111','66666666-6666-4666-8666-666666666666','accepted'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','pending');
\ir ../candidates/build17_private_player_references_review_only.sql
do $$begin
 if has_table_privilege('authenticated','private.player_reference_requests','select') or has_table_privilege('authenticated','private.player_reference_requests','insert') or has_table_privilege('authenticated','private.player_reference_requests','update') or has_table_privilege('authenticated','private.player_reference_requests','delete') or has_function_privilege('anon','public.player_reference_action(uuid,text)','execute') then raise exception 'unsafe grants';end if;
end$$;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $begin
 begin perform public.player_reference_action('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','read');raise exception 'disabled gate bypass';exception when insufficient_privilege then null;end;
end$;
reset role;
update private.player_reference_feature_gate set enabled=true;
set role authenticated;
select set_config('request.jwt.claims','{"aal":"aal1","user_metadata":{"aal":"aal2"}}',false);
do $begin
 begin perform public.player_reference_action('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','read');raise exception 'MFA bypass';exception when insufficient_privilege then null;end;
end$;
select set_config('request.jwt.claims','{"aal":"aal2"}',false);
do $declare s jsonb;begin
 s:=public.player_reference_action('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','read');
 if s->>'state'<>'none' or (s->>'canRequest')::boolean is not true then raise exception 'expected request ability';end if;
 s:=public.player_reference_action('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','request');
 if s->>'state'<>'pending' or (s->>'canRespond')::boolean then raise exception 'requester may not consent';end if;
 begin perform public.player_reference_action('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','accept');raise exception 'requester accepted own request';exception when insufficient_privilege then null;end;
 begin perform public.player_reference_action('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5','request');raise exception 'unverified player accepted';exception when insufficient_privilege then null;end;
 perform public.player_reference_action('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','request');
 perform public.player_reference_action('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','request');
 begin perform public.player_reference_action('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','request');raise exception 'limit not applied' using errcode='XX000';exception when raise_exception then null;end;
end$$;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
do $$begin
 begin perform public.player_reference_action('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','read');raise exception 'third party read';exception when insufficient_privilege then null;end;
 begin perform public.player_reference_action('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6','read');raise exception 'pending connection read';exception when insufficient_privilege then null;end;
 if (public.player_reference_action('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','decline')->>'state')<>'declined' then raise exception 'decline failed';end if;
end$$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $$begin
 if (public.player_reference_action('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','read')->>'canRespond')::boolean is not true then raise exception 'recipient cannot respond';end if;
 if public.player_reference_action('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','accept')->>'state'<>'accepted' then raise exception 'accept failed';end if;
end$$;
reset role;
insert into public.user_blocks values ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111');
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$begin
 begin perform public.player_reference_action('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','read');raise exception 'blocked user read';exception when insufficient_privilege then null;end;
 if public.player_reference_action('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','revoke')->>'state'<>'revoked' then raise exception 'revoke failed';end if;
end$$;
reset role;
delete from public.user_blocks;
update private.player_reference_requests set created_at=now()-interval '31 days',expires_at=now()-interval '1 day' where connection_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$begin
 if public.player_reference_action('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','request')->>'state'<>'revoked' then raise exception 'revoked request reactivated';end if;
 if public.player_reference_action('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','read')->>'state'<>'expired' then raise exception 'expiry not enforced';end if;
end$$;
reset role;
