#!/usr/bin/env node
/**
 * Synthetic PostgreSQL 17 follow-avatar moderation regression.
 * Emits SQL for a disposable local database; never connects to Supabase.
 * --unsafe-avatar-bypass intentionally removes masking to prove tests fail.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const candidate=readFileSync(new URL("../supabase/candidates/build9_public_follow_avatar_mask_review_only.sql",import.meta.url),"utf8");
assert.match(candidate,/^BEGIN;$/m);
assert.match(candidate,/^ROLLBACK;$/m);
assert.match(candidate,/557d85a6abf873e47ffc1f4ae283debd/);
const match=[...candidate.matchAll(/CREATE OR REPLACE FUNCTION public\.get_public_follow_list\([\s\S]*?\$function\$;/g)];
assert.equal(match.length,1,"Expected exactly one reviewed follow-list function");
let functionSql=match[0][0];
if(process.argv.includes("--unsafe-avatar-bypass")){
 const original=functionSql;
 functionSql=functionSql.replace(/CASE WHEN follower\.avatar_moderation_status IS NULL\s+OR follower\.avatar_moderation_status = 'approved'\s+THEN follower\.avatar_url ELSE NULL END/g,"follower.avatar_url")
 .replace(/CASE WHEN target_profile\.avatar_moderation_status IS NULL\s+OR target_profile\.avatar_moderation_status = 'approved'\s+THEN target_profile\.avatar_url ELSE NULL END/g,"target_profile.avatar_url");
 assert.notEqual(original,functionSql,"Did not modify synthetic function");
 assert.doesNotMatch(functionSql,/follower\.avatar_moderation_status/);
 assert.doesNotMatch(functionSql,/target_profile\.avatar_moderation_status/);
}
const setup=[
 "\\set ON_ERROR_STOP on",
 "BEGIN;",
 "CREATE SCHEMA auth;",
 "CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
 "DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; END $$;",
 "CREATE TABLE public.profiles(id uuid PRIMARY KEY,profile_visibility text,display_name text,avatar_url text,avatar_moderation_status text,account_type text,player_verified boolean);",
 "CREATE TABLE public.follow_relationships(follower_id uuid,target_type text,target_id uuid,created_at timestamptz DEFAULT now());",
 "CREATE TABLE public.teams(id uuid PRIMARY KEY,name text,logo_url text);",
 "CREATE TABLE public.womens_teams(id uuid PRIMARY KEY,name text,logo_url text);",
 "INSERT INTO public.profiles VALUES",
 "('11111111-1111-4111-8111-111111111111','public','Pending','https://fixture.test/pending.jpg','pending','player',false),",
 "('22222222-2222-4222-8222-222222222222','public','Approved','https://fixture.test/approved.jpg','approved','player',true),",
 "('33333333-3333-4333-8333-333333333333','public','Rejected','https://fixture.test/rejected.jpg','rejected','player',false),",
 "('44444444-4444-4444-8444-444444444444','public','Legacy','https://fixture.test/legacy.jpg',NULL,'player',false),",
 "('55555555-5555-4555-8555-555555555555','private','Private','https://fixture.test/private.jpg','approved','player',false),",
 "('77777777-7777-4777-8777-777777777777','public','Target','https://fixture.test/target.jpg','approved','player',true);",
 "INSERT INTO public.teams VALUES ('88888888-8888-4888-8888-888888888888','Mens Team','https://fixture.test/team-logo.png');",
 "INSERT INTO public.womens_teams VALUES ('99999999-9999-4999-8999-999999999999','Womens Team','https://fixture.test/women-logo.png');",
 "INSERT INTO public.follow_relationships(follower_id,target_type,target_id) VALUES",
 "('11111111-1111-4111-8111-111111111111','player','77777777-7777-4777-8777-777777777777'),",
 "('22222222-2222-4222-8222-222222222222','player','77777777-7777-4777-8777-777777777777'),",
 "('33333333-3333-4333-8333-333333333333','player','77777777-7777-4777-8777-777777777777'),",
 "('44444444-4444-4444-8444-444444444444','player','77777777-7777-4777-8777-777777777777'),",
 "('55555555-5555-4555-8555-555555555555','player','77777777-7777-4777-8777-777777777777'),",
 "('22222222-2222-4222-8222-222222222222','player','11111111-1111-4111-8111-111111111111'),",
 "('22222222-2222-4222-8222-222222222222','player','33333333-3333-4333-8333-333333333333'),",
 "('22222222-2222-4222-8222-222222222222','player','55555555-5555-4555-8555-555555555555'),",
 "('22222222-2222-4222-8222-222222222222','team','88888888-8888-4888-8888-888888888888'),",
 "('22222222-2222-4222-8222-222222222222','team','99999999-9999-4999-8999-999999999999');"
];
const assertions=[
 "REVOKE ALL ON FUNCTION public.get_public_follow_list(text,text,uuid,uuid) FROM PUBLIC;",
 "GRANT USAGE ON SCHEMA public TO anon,authenticated;",
 "GRANT EXECUTE ON FUNCTION public.get_public_follow_list(text,text,uuid,uuid) TO anon,authenticated;",
 "SET LOCAL ROLE anon;",
 "DO $fixture$",
 "DECLARE",
 "  target_profile_id uuid := '77777777-7777-4777-8777-777777777777';",
 "  reader_id uuid := '22222222-2222-4222-8222-222222222222';",
 "  found_count integer;",
 "  avatar text;",
 "BEGIN",
 "  SELECT count(*) INTO found_count FROM public.get_public_follow_list('followers','player',target_profile_id,NULL);",
 "  IF found_count<>4 THEN RAISE EXCEPTION 'FOLLOWERS private follower visible or expected follower missing %',found_count; END IF;",
 "  SELECT avatar_url INTO avatar FROM public.get_public_follow_list('followers','player',target_profile_id,NULL) WHERE id='11111111-1111-4111-8111-111111111111';",
 "  IF NOT FOUND OR avatar IS NOT NULL THEN RAISE EXCEPTION 'FOLLOWERS pending avatar exposed'; END IF;",
 "  SELECT avatar_url INTO avatar FROM public.get_public_follow_list('followers','player',target_profile_id,NULL) WHERE id='33333333-3333-4333-8333-333333333333';",
 "  IF NOT FOUND OR avatar IS NOT NULL THEN RAISE EXCEPTION 'FOLLOWERS rejected avatar exposed'; END IF;",
 "  SELECT avatar_url INTO avatar FROM public.get_public_follow_list('followers','player',target_profile_id,NULL) WHERE id='22222222-2222-4222-8222-222222222222';",
 "  IF NOT FOUND OR avatar IS DISTINCT FROM 'https://fixture.test/approved.jpg' THEN RAISE EXCEPTION 'FOLLOWERS approved avatar missing'; END IF;",
 "  SELECT avatar_url INTO avatar FROM public.get_public_follow_list('followers','player',target_profile_id,NULL) WHERE id='44444444-4444-4444-8444-444444444444';",
 "  IF NOT FOUND OR avatar IS DISTINCT FROM 'https://fixture.test/legacy.jpg' THEN RAISE EXCEPTION 'FOLLOWERS legacy-null avatar changed'; END IF;",
 "  SELECT count(*) INTO found_count FROM public.get_public_follow_list('following',NULL,NULL,reader_id);",
 "  IF found_count<>5 THEN RAISE EXCEPTION 'FOLLOWING count or visibility wrong %',found_count; END IF;",
 "  SELECT avatar_url INTO avatar FROM public.get_public_follow_list('following',NULL,NULL,reader_id) WHERE target_id='11111111-1111-4111-8111-111111111111';",
 "  IF NOT FOUND OR avatar IS NOT NULL THEN RAISE EXCEPTION 'FOLLOWING pending target avatar exposed'; END IF;",
 "  SELECT avatar_url INTO avatar FROM public.get_public_follow_list('following',NULL,NULL,reader_id) WHERE target_id='33333333-3333-4333-8333-333333333333';",
 "  IF NOT FOUND OR avatar IS NOT NULL THEN RAISE EXCEPTION 'FOLLOWING rejected target avatar exposed'; END IF;",
 "  SELECT avatar_url INTO avatar FROM public.get_public_follow_list('following',NULL,NULL,reader_id) WHERE target_id='77777777-7777-4777-8777-777777777777';",
 "  IF NOT FOUND OR avatar IS DISTINCT FROM 'https://fixture.test/target.jpg' THEN RAISE EXCEPTION 'FOLLOWING approved target avatar missing'; END IF;",
 "  SELECT avatar_url INTO avatar FROM public.get_public_follow_list('following',NULL,NULL,reader_id) WHERE target_id='88888888-8888-4888-8888-888888888888';",
 "  IF NOT FOUND OR avatar IS DISTINCT FROM 'https://fixture.test/team-logo.png' THEN RAISE EXCEPTION 'FOLLOWING men team logo missing'; END IF;",
 "  SELECT avatar_url INTO avatar FROM public.get_public_follow_list('following',NULL,NULL,reader_id) WHERE target_id='99999999-9999-4999-8999-999999999999';",
 "  IF NOT FOUND OR avatar IS DISTINCT FROM 'https://fixture.test/women-logo.png' THEN RAISE EXCEPTION 'FOLLOWING women team logo missing'; END IF;",
 "  SELECT count(*) INTO found_count FROM public.get_public_follow_list('following',NULL,NULL,'55555555-5555-4555-8555-555555555555');",
 "  IF found_count<>0 THEN RAISE EXCEPTION 'FOLLOWING hidden private follower visible'; END IF;",
 "END $fixture$;",
 "RESET ROLE;",
 "ROLLBACK;",
 "SELECT 'PASS: PG17 avatar masking, consent and team logos in synthetic PG fixture' AS result;"
];
process.stdout.write(setup.join("\n")+"\n"+functionSql+"\n"+assertions.join("\n")+"\n");
