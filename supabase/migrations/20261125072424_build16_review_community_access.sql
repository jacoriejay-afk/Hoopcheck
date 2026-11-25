-- Keep review community actions aligned with the full-review entitlement.
-- Private helper returns only a caller-scoped boolean for an approved review.
create or replace function private.can_interact_with_approved_review(p_review_id uuid)
returns boolean language sql stable security definer set search_path=''
as $function$
  select auth.uid() is not null
    and exists(select 1 from public.reviews r where r.id=p_review_id and r.status='approved')
    and (
      private.is_admin_or_moderator()
      or exists (
        select 1 from public.profiles p
        join public.subscriptions s on s.user_id=p.id
        where p.id=auth.uid()
          and p.account_type in ('player','fan','coach','scout','agent','club_admin','manager','admin')
          and s.plan in ('pro','premium')
          and s.status in ('active','trialing')
          and (s.current_period_end is null or s.current_period_end>pg_catalog.now())
          and (p.account_type<>'fan' or s.plan='premium')
      )
    );
$function$;
revoke all on function private.can_interact_with_approved_review(uuid) from public,anon;
grant execute on function private.can_interact_with_approved_review(uuid) to authenticated;
alter policy "review likes own" on public.review_likes
  with check (user_id=(select auth.uid()) and private.can_interact_with_approved_review(review_id));
alter policy "review comments own insert" on public.review_comments
  with check (author_id=(select auth.uid()) and status='pending' and private.can_interact_with_approved_review(review_id));
-- Preserve authors' own comment reads (including pending comments) for rate limiting.
alter policy "review comments paid read guard" on public.review_comments
  using ((select auth.uid()) is not null and (
    author_id=(select auth.uid()) or private.is_admin_or_moderator()
    or (status='approved' and private.can_interact_with_approved_review(review_id))
  ));
