-- Provision isolated private HoopFeed buckets without changing existing public
-- feed-images / feed-videos buckets used by legacy and fan content.
-- This is infrastructure only; do not migrate clients until signed media delivery
-- and authenticated upload authorization have been implemented and tested.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('hoopfeed-private-images', 'hoopfeed-private-images', false, 8388608,
   array['image/jpeg','image/png','image/webp']::text[]),
  ('hoopfeed-private-videos', 'hoopfeed-private-videos', false, 104857600,
   array['video/mp4','video/webm','video/quicktime']::text[])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Deliberately grant no anon/authenticated storage.objects policies here.
-- Service-role uploads can operate during the future server-side rollout.
-- Signed URL issuance must first verify the requesting viewer's post access.
commit;
