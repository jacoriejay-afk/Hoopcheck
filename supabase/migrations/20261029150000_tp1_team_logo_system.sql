-- TP-1: shared logo presentation metadata for team profiles.
alter table public.teams
  add column if not exists logo_url text,
  add column if not exists logo_bg text not null default 'transparent'
    check (logo_bg in ('transparent', 'light', 'dark'));

alter table public.womens_teams
  add column if not exists logo_url text,
  add column if not exists logo_bg text not null default 'transparent'
    check (logo_bg in ('transparent', 'light', 'dark'));

-- Keep approved logo files on our own Supabase Storage domain.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('team-logos', 'team-logos', true, 5242880, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/png','image/jpeg','image/webp','image/svg+xml'];

drop policy if exists "Team logos are publicly readable" on storage.objects;
create policy "Team logos are publicly readable"
on storage.objects for select
to public
using (bucket_id = 'team-logos');

drop policy if exists "Admins can manage team logos" on storage.objects;
create policy "Admins can manage team logos"
on storage.objects for all
to authenticated
using (bucket_id = 'team-logos' and public.is_current_user_admin_or_moderator())
with check (bucket_id = 'team-logos' and public.is_current_user_admin_or_moderator());
