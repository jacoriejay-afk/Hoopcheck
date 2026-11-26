\set ON_ERROR_STOP on
begin;
create schema auth;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create table auth.users(id uuid primary key,email_confirmed_at timestamptz,role text);
create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
create table auth.identities(user_id uuid,provider text,provider_id text);
insert into auth.users values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now(),'hoopcheck_pending_signup'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',now(),'authenticated');
insert into auth.sessions values ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null),('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',null),('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now()-interval '1 day');
insert into auth.identities values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','apple','apple-a'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','apple','apple-b');
\i supabase/candidates/appstore_apple_authorization_vault.sql
do $$ begin
 if has_function_privilege('anon','public.store_verified_apple_authorization(uuid,uuid,text,text)','EXECUTE')
 or has_function_privilege('authenticated','public.store_verified_apple_authorization(uuid,uuid,text,text)','EXECUTE')
 or has_table_privilege('service_role','hoopcheck_apple_private.authorization_vault','SELECT')
 or has_table_privilege('authenticated','hoopcheck_apple_private.authorization_vault','SELECT')
 then raise exception 'Vault grants are too broad'; end if;
end $$;
set local role service_role;
do $$
declare a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; s uuid; envelope text:='v1.fixtureIV.fixtureTag.fixtureCiphertext';
begin
 foreach s in array array['22222222-2222-4222-8222-222222222222'::uuid,'33333333-3333-4333-8333-333333333333'::uuid] loop
  begin perform public.store_verified_apple_authorization(a,s,'apple-a',envelope);
   raise exception 'Invalid session accepted'; exception when insufficient_privilege then null; end;
 end loop;
 begin perform public.store_verified_apple_authorization(a,'11111111-1111-4111-8111-111111111111','apple-b',envelope);
  raise exception 'Foreign subject accepted'; exception when insufficient_privilege then null; end;
 if not public.store_verified_apple_authorization(a,'11111111-1111-4111-8111-111111111111','apple-a',envelope) then raise exception 'Valid Apple session rejected'; end if;
 if not public.store_verified_apple_authorization(a,'11111111-1111-4111-8111-111111111111','apple-a','v1.newIV.newTag.newCiphertext') then raise exception 'Valid retry rejected'; end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from hoopcheck_apple_private.authorization_vault)<>1
 or not exists(select 1 from hoopcheck_apple_private.authorization_vault where owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and apple_subject='apple-a' and encrypted_refresh_token='v1.newIV.newTag.newCiphertext')
 then raise exception 'Unexpected vault write'; end if;
end $$;
rollback;
\echo PASS: private vault, verified session and provider subject, no broad grants
