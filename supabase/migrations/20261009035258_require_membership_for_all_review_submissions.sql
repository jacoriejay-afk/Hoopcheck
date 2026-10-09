drop policy if exists "reviews verified players insert" on public.reviews;

create policy "reviews verified paid players insert pending"
on public.reviews
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and status = 'pending'
  and private.is_active_subscriber()
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.account_type = 'player'
      and p.player_verified = true
  )
);
