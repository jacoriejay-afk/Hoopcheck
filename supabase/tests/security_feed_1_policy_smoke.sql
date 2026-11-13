-- Run after the matching migration against a current schema. All fixture writes roll back.
begin;
insert into auth.users(id,email,raw_user_meta_data)
select ('7ea17a00-baba-4abc-9100-10000000000' || i)::uuid,
  'hc-privacy-7ea17-' || i || '@example.invalid',
  jsonb_build_object('birthdate','1990-01-01','gender','prefer_not_to_say',
    'position','PG','account_type',case when i=3 then 'fan' else 'player' end,'username','hc_privacy_7ea17_' || i,
    'agreed_to_terms',true,'terms_accepted_at',now(),'terms_version','fixture')
from generate_series(1,7) i;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"7ea17a00-baba-4abc-9100-100000000001","role":"authenticated"}',true);
update public.profiles set profile_visibility='private' where id='7ea17a00-baba-4abc-9100-100000000001';
reset role;
select set_config('request.jwt.claims','{}',true);
insert into public.subscriptions(user_id,plan,status,access_status,current_period_end) values ('7ea17a00-baba-4abc-9100-100000000001','pro','active','pro', now() + interval '1 day'),('7ea17a00-baba-4abc-9100-100000000002','pro','active','pro', now() + interval '1 day'),('7ea17a00-baba-4abc-9100-100000000003','pro','active','pro', now() + interval '1 day'),('7ea17a00-baba-4abc-9100-100000000004','pro','active','pro', now() + interval '1 day'),('7ea17a00-baba-4abc-9100-100000000006','pro','active','pro', now() + interval '1 day'),('7ea17a00-baba-4abc-9100-100000000007','pro','active','pro', now() - interval '1 day') on conflict (user_id) do update set plan=excluded.plan,status=excluded.status,access_status=excluded.access_status,current_period_end=excluded.current_period_end;
insert into public.admin_roles(user_id,role) values ('7ea17a00-baba-4abc-9100-100000000006','moderator');
insert into public.follow_relationships(follower_id,target_type,target_id) values ('7ea17a00-baba-4abc-9100-100000000002','player','7ea17a00-baba-4abc-9100-100000000001'),('7ea17a00-baba-4abc-9100-100000000004','player','7ea17a00-baba-4abc-9100-100000000001'),('7ea17a00-baba-4abc-9100-100000000005','player','7ea17a00-baba-4abc-9100-100000000001'),('7ea17a00-baba-4abc-9100-100000000007','player','7ea17a00-baba-4abc-9100-100000000001'),('7ea17a00-baba-4abc-9100-100000000003','player','7ea17a00-baba-4abc-9100-100000000002'),('7ea17a00-baba-4abc-9100-100000000002','fan','7ea17a00-baba-4abc-9100-100000000003');
insert into public.user_blocks(blocker_id,blocked_id) values ('7ea17a00-baba-4abc-9100-100000000001','7ea17a00-baba-4abc-9100-100000000004');
insert into public.feed_posts(id,author_id,body,status,post_kind,poll_options,expires_at) values ('7ea17b00-baba-4abc-9100-100000000001','7ea17a00-baba-4abc-9100-100000000001','fixture original','approved','poll','["One","Two"]'::jsonb,now()+interval '1 day'),('7ea17b00-baba-4abc-9100-100000000004','7ea17a00-baba-4abc-9100-100000000001','fixture expired','approved','discussion',null,now()-interval '1 day'),('7ea17b00-baba-4abc-9100-100000000005','7ea17a00-baba-4abc-9100-100000000001','fixture pending','pending','discussion',null,null);
insert into public.feed_posts(id,author_id,body,status,shared_post_id) values ('7ea17b00-baba-4abc-9100-100000000002','7ea17a00-baba-4abc-9100-100000000002','fixture reshare','approved','7ea17b00-baba-4abc-9100-100000000001'),('7ea17b00-baba-4abc-9100-100000000003','7ea17a00-baba-4abc-9100-100000000003','fixture nested reshare','approved','7ea17b00-baba-4abc-9100-100000000002'),('7ea17b00-baba-4abc-9100-100000000006','7ea17a00-baba-4abc-9100-100000000002','fixture cycle A','approved',null),('7ea17b00-baba-4abc-9100-100000000007','7ea17a00-baba-4abc-9100-100000000002','fixture cycle B','approved','7ea17b00-baba-4abc-9100-100000000006');
update public.feed_posts set shared_post_id='7ea17b00-baba-4abc-9100-100000000007' where id='7ea17b00-baba-4abc-9100-100000000006';
insert into public.feed_poll_votes(post_id,user_id,option_index) values ('7ea17b00-baba-4abc-9100-100000000001','7ea17a00-baba-4abc-9100-100000000002',0);
insert into public.feed_post_checks(post_id,user_id) values ('7ea17b00-baba-4abc-9100-100000000001','7ea17a00-baba-4abc-9100-100000000002');
insert into public.feed_post_comments(post_id,author_id,body) values ('7ea17b00-baba-4abc-9100-100000000001','7ea17a00-baba-4abc-9100-100000000002','fixture comment');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','7ea17a00-baba-4abc-9100-100000000001','role','authenticated')::text,true);
do $$ begin
if (exists(select 1 from public.feed_posts where id='7ea17b00-baba-4abc-9100-100000000001')) is distinct from true
or (exists(select 1 from public.feed_posts where id='7ea17b00-baba-4abc-9100-100000000002')) is distinct from false
or (exists(select 1 from public.feed_poll_votes where post_id='7ea17b00-baba-4abc-9100-100000000001')) is distinct from true
or (exists(select 1 from public.feed_post_comments where post_id='7ea17b00-baba-4abc-9100-100000000001')) is distinct from true
or (exists(select 1 from public.feed_post_checks where post_id='7ea17b00-baba-4abc-9100-100000000001')) is distinct from true
or exists(select 1 from public.feed_posts where id in ('7ea17b00-baba-4abc-9100-100000000004','7ea17b00-baba-4abc-9100-100000000006','7ea17b00-baba-4abc-9100-100000000007'))
then raise exception 'HoopFeed fixture failed for 7ea17a00-baba-4abc-9100-100000000001'; end if; end $$;
select set_config('request.jwt.claims', json_build_object('sub','7ea17a00-baba-4abc-9100-100000000002','role','authenticated')::text,true);
do $$ begin
if (exists(select 1 from public.feed_posts where id='7ea17b00-baba-4abc-9100-100000000001')) is distinct from true
or (exists(select 1 from public.feed_posts where id='7ea17b00-baba-4abc-9100-100000000002')) is distinct from true
or (exists(select 1 from public.feed_poll_votes where post_id='7ea17b00-baba-4abc-9100-100000000001')) is distinct from true
or (exists(select 1 from public.feed_post_comments where post_id='7ea17b00-baba-4abc-9100-100000000001')) is distinct from true
or (exists(select 1 from public.feed_post_checks where post_id='7ea17b00-baba-4abc-9100-100000000001')) is distinct from true
or exists(select 1 from public.feed_posts where id in ('7ea17b00-baba-4abc-9100-100000000004','7ea17b00-baba-4abc-9100-100000000006','7ea17b00-baba-4abc-9100-100000000007'))
then raise exception 'HoopFeed fixture failed for 7ea17a00-baba-4abc-9100-100000000002'; end if; end $$;
select set_config('request.jwt.claims', json_build_object('sub','7ea17a00-baba-4abc-9100-100000000003','role','authenticated')::text,true);
do $$ begin
if (exists(select 1 from public.feed_posts where id='7ea17b00-baba-4abc-9100-100000000001')) is distinct from false
or (exists(select 1 from public.feed_posts where id='7ea17b00-baba-4abc-9100-100000000002')) is distinct from false
or (exists(select 1 from public.feed_poll_votes where post_id='7ea17b00-baba-4abc-9100-100000000001')) is distinct from false
or (exists(select 1 from public.feed_post_comments where post_id='7ea17b00-baba-4abc-9100-100000000001')) is distinct from false
or (exists(select 1 from public.feed_post_checks where post_id='7ea17b00-baba-4abc-9100-100000000001')) is distinct from false
or exists(select 1 from public.feed_posts where id in ('7ea17b00-baba-4abc-9100-100000000004','7ea17b00-baba-4abc-9100-100000000006','7ea17b00-baba-4abc-9100-100000000007'))
then raise exception 'HoopFeed fixture failed for 7ea17a00-baba-4abc-9100-100000000003'; end if; end $$;
select set_config('request.jwt.claims', json_build_object('sub','7ea17a00-baba-4abc-9100-100000000004','role','authenticated')::text,true);
do $$ begin
if (exists(select 1 from public.feed_posts where id='7ea17b00-baba-4abc-9100-100000000001')) is distinct from false
or (exists(select 1 from public.feed_posts where id='7ea17b00-baba-4abc-9100-100000000002')) is distinct from false
or (exists(select 1 from public.feed_poll_votes where post_id='7ea17b00-baba-4abc-9100-100000000001')) is distinct from false
or (exists(select 1 from public.feed_post_comments where post_id='7ea17b00-baba-4abc-9100-100000000001')) is distinct from false
or (exists(select 1 from public.feed_post_checks where post_id='7ea17b00-baba-4abc-9100-100000000001')) is distinct from false
or exists(select 1 from public.feed_posts where id in ('7ea17b00-baba-4abc-9100-100000000004','7ea17b00-baba-4abc-9100-100000000006','7ea17b00-baba-4abc-9100-100000000007'))
then raise exception 'HoopFeed fixture failed for 7ea17a00-baba-4abc-9100-100000000004'; end if; end $$;
select set_config('request.jwt.claims', json_build_object('sub','7ea17a00-baba-4abc-9100-100000000005','role','authenticated')::text,true);
do $$ begin
if (exists(select 1 from public.feed_posts where id='7ea17b00-baba-4abc-9100-100000000001')) is distinct from false
or (exists(select 1 from public.feed_posts where id='7ea17b00-baba-4abc-9100-100000000002')) is distinct from false
or (exists(select 1 from public.feed_poll_votes where post_id='7ea17b00-baba-4abc-9100-100000000001')) is distinct from false
or (exists(select 1 from public.feed_post_comments where post_id='7ea17b00-baba-4abc-9100-100000000001')) is distinct from false
or (exists(select 1 from public.feed_post_checks where post_id='7ea17b00-baba-4abc-9100-100000000001')) is distinct from false
or exists(select 1 from public.feed_posts where id in ('7ea17b00-baba-4abc-9100-100000000004','7ea17b00-baba-4abc-9100-100000000006','7ea17b00-baba-4abc-9100-100000000007'))
then raise exception 'HoopFeed fixture failed for 7ea17a00-baba-4abc-9100-100000000005'; end if; end $$;
select set_config('request.jwt.claims', json_build_object('sub','7ea17a00-baba-4abc-9100-100000000007','role','authenticated')::text,true);
do $$ begin
if (exists(select 1 from public.feed_posts where id='7ea17b00-baba-4abc-9100-100000000001')) is distinct from false
or (exists(select 1 from public.feed_posts where id='7ea17b00-baba-4abc-9100-100000000002')) is distinct from false
or (exists(select 1 from public.feed_poll_votes where post_id='7ea17b00-baba-4abc-9100-100000000001')) is distinct from false
or (exists(select 1 from public.feed_post_comments where post_id='7ea17b00-baba-4abc-9100-100000000001')) is distinct from false
or (exists(select 1 from public.feed_post_checks where post_id='7ea17b00-baba-4abc-9100-100000000001')) is distinct from false
or exists(select 1 from public.feed_posts where id in ('7ea17b00-baba-4abc-9100-100000000004','7ea17b00-baba-4abc-9100-100000000006','7ea17b00-baba-4abc-9100-100000000007'))
then raise exception 'HoopFeed fixture failed for 7ea17a00-baba-4abc-9100-100000000007'; end if; end $$;
select set_config('request.jwt.claims', json_build_object('sub','7ea17a00-baba-4abc-9100-100000000006','role','authenticated')::text,true);
do $$ begin
if (exists(select 1 from public.feed_posts where id='7ea17b00-baba-4abc-9100-100000000001')) is distinct from true
or (exists(select 1 from public.feed_posts where id='7ea17b00-baba-4abc-9100-100000000002')) is distinct from true
or (exists(select 1 from public.feed_poll_votes where post_id='7ea17b00-baba-4abc-9100-100000000001')) is distinct from true
or (exists(select 1 from public.feed_post_comments where post_id='7ea17b00-baba-4abc-9100-100000000001')) is distinct from true
or (exists(select 1 from public.feed_post_checks where post_id='7ea17b00-baba-4abc-9100-100000000001')) is distinct from true
or exists(select 1 from public.feed_posts where id in ('7ea17b00-baba-4abc-9100-100000000004','7ea17b00-baba-4abc-9100-100000000006','7ea17b00-baba-4abc-9100-100000000007'))
then raise exception 'HoopFeed fixture failed for 7ea17a00-baba-4abc-9100-100000000006'; end if; end $$;
select set_config('request.jwt.claims', json_build_object('sub','7ea17a00-baba-4abc-9100-100000000002','role','authenticated')::text,true);
do $$ begin if not exists(select 1 from public.feed_posts where id='7ea17b00-baba-4abc-9100-100000000003') then raise exception 'Expected nested share for eligible viewer'; end if; end $$;
select set_config('request.jwt.claims', json_build_object('sub','7ea17a00-baba-4abc-9100-100000000004','role','authenticated')::text,true);
do $$ begin if exists(select 1 from public.user_blocks where blocker_id='7ea17a00-baba-4abc-9100-100000000001' and blocked_id='7ea17a00-baba-4abc-9100-100000000004') then raise exception 'Block disclosed to recipient'; end if; end $$;
reset role;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin if exists(select 1 from public.feed_posts where id='7ea17b00-baba-4abc-9100-100000000001') then raise exception 'Anonymous access'; end if; exception when insufficient_privilege then null; end $$;
reset role;
do $ begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
    and tablename = 'feed_posts' and policyname = 'unified hoopfeed approved posts read'
    and qual like '%hoopfeed_can_read_reshare_source%') then
    raise exception 'HoopFeed policy is missing the reshare guard';
  end if;
end $;
select 'HoopFeed RLS matrix passed' as result;
rollback;
