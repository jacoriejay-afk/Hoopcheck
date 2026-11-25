-- Bound direct moderation submissions without changing read or staff RPC permissions.
create index if not exists profile_reports_reporter_created_security_idx on public.profile_reports(reporter_id,created_at desc);
create index if not exists review_comments_author_created_security_idx on public.review_comments(author_id,created_at desc);
revoke update,delete on public.profile_reports from public,anon,authenticated;

create or replace function private.enforce_profile_report_limit()
returns trigger language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); ts timestamptz; n_hour bigint; n_day bigint;
begin
  if current_user <> 'authenticated' then return new; end if;
  if u is null or new.reporter_id is distinct from u then
    raise exception 'Invalid reporter' using errcode='42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hoopcheck:profile-report:'||u::text,0));
  ts:=pg_catalog.clock_timestamp();
  new.created_at:=ts;
  select count(*) filter(where created_at>ts-interval '1 hour'),count(*) into n_hour,n_day
    from public.profile_reports where reporter_id=u and created_at>ts-interval '24 hours';
  if n_hour>=10 or n_day>=30 then
    raise exception 'Report submission rate limit reached' using errcode='P0001';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_profile_report_limit() from public,anon,authenticated;
drop trigger if exists enforce_profile_report_limit on public.profile_reports;
create trigger enforce_profile_report_limit before insert on public.profile_reports for each row execute function private.enforce_profile_report_limit();

create or replace function private.enforce_review_comment_limit()
returns trigger language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); ts timestamptz; n_short bigint; n_day bigint;
begin
  if current_user <> 'authenticated' then return new; end if;
  if u is null or new.author_id is distinct from u then
    raise exception 'Invalid comment author' using errcode='42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hoopcheck:review-comment:'||u::text,0));
  ts:=pg_catalog.clock_timestamp();
  new.created_at:=ts;
  select count(*) filter(where created_at>ts-interval '10 minutes'),count(*) into n_short,n_day
    from public.review_comments where author_id=u and created_at>ts-interval '24 hours';
  if n_short>=20 or n_day>=100 then
    raise exception 'Comment submission rate limit reached' using errcode='P0001';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_review_comment_limit() from public,anon,authenticated;
drop trigger if exists enforce_review_comment_limit on public.review_comments;
create trigger enforce_review_comment_limit before insert on public.review_comments for each row execute function private.enforce_review_comment_limit();
