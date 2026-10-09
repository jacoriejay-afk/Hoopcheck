-- Close direct Data API reads that could bypass the paid review paywall.
-- Paid non-fan members can read approved review content; authors retain access
-- to their own submissions and moderators/admins retain moderation access.
-- Rating-only access for premium fans should use the summary RPC, not table rows.
alter table public.reviews enable row level security;

create policy "reviews paid read guard"
on public.reviews
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
