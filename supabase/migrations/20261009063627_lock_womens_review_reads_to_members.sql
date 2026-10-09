-- Ensure direct Data API reads cannot bypass the women's review paywall.
-- Approved review text is for active non-fan members; authors can still see their
-- own submissions, and admins/moderators retain moderation access.
alter table public.womens_team_reviews enable row level security;

create policy "womens review paid read guard"
on public.womens_team_reviews
as restrictive
for select
to anon, authenticated
using (
  (select auth.uid()) is not null
  and (
    author_id = (select auth.uid())
    or private.is_admin_or_moderator()
    or (
      private.is_active_subscriber()
      and exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and p.account_type <> 'fan'
      )
    )
  )
);
