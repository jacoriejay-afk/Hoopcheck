-- Protect both review categories even when an authenticated client bypasses the web API.
-- Existing RLS eligibility, legal review and API rate-limit checks are preserved.
create index if not exists reviews_author_created_security_idx on public.reviews(author_id,created_at desc);
create index if not exists womens_reviews_author_created_security_idx on public.womens_team_reviews(author_id,created_at desc);

create or replace function private.enforce_review_submission()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_now timestamptz;
  v_confirmed timestamptz;
  v_staff boolean;
  v_count bigint;
begin
  if v_user is null or new.author_id is distinct from v_user then
    raise exception 'Review author must match the authenticated user' using errcode='42501';
  end if;
  select u.email_confirmed_at into v_confirmed from auth.users u where u.id=v_user;
  select exists(select 1 from public.admin_roles ar where ar.user_id=v_user and trim(lower(ar.role)) in ('admin','moderator')) into v_staff;
  if v_confirmed is null and not v_staff then
    raise exception 'Email confirmation is required before submitting a review' using errcode='42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hoopcheck:review-row:' || v_user::text,0));
  v_now := pg_catalog.clock_timestamp();
  new.created_at := v_now;
  if not v_staff then
    select (select count(*) from public.reviews r where r.author_id=v_user and r.created_at>=v_now-interval '24 hours')
         + (select count(*) from public.womens_team_reviews r where r.author_id=v_user and r.created_at>=v_now-interval '24 hours')
    into v_count;
    if v_count>=5 then
      raise exception 'Review limit reached: maximum 5 reviews per 24 hours' using errcode='P0001';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_review_submission() from public,anon,authenticated;

drop trigger if exists enforce_review_submission on public.reviews;
create trigger enforce_review_submission before insert on public.reviews for each row execute function private.enforce_review_submission();
drop trigger if exists enforce_review_submission on public.womens_team_reviews;
create trigger enforce_review_submission before insert on public.womens_team_reviews for each row execute function private.enforce_review_submission();

create or replace function private.protect_review_author_and_created_at()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if current_user in ('anon','authenticated') and (new.author_id is distinct from old.author_id or new.created_at is distinct from old.created_at) then
    raise exception 'Review author and creation time are immutable' using errcode='42501';
  end if;
  return new;
end;
$$;
revoke all on function private.protect_review_author_and_created_at() from public,anon,authenticated;
drop trigger if exists protect_review_author_and_created_at on public.reviews;
create trigger protect_review_author_and_created_at before update of author_id,created_at on public.reviews for each row execute function private.protect_review_author_and_created_at();
drop trigger if exists protect_review_author_and_created_at on public.womens_team_reviews;
create trigger protect_review_author_and_created_at before update of author_id,created_at on public.womens_team_reviews for each row execute function private.protect_review_author_and_created_at();
