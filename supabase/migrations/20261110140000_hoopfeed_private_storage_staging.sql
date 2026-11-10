-- Staged private HoopFeed buckets. Do NOT change the existing feed-images
-- or feed-videos buckets: Fan Feed and Team Fan Feed share those assets.
-- Server-side service-role uploads and signed reads are the only supported
-- access path until post-level audience authorization is complete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('hoopfeed-private-images', 'hoopfeed-private-images', false, 8388608, array['image/jpeg','image/png','image/webp']),
  ('hoopfeed-private-videos', 'hoopfeed-private-videos', false, 52428800, array['video/mp4','video/webm','video/quicktime'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- No authenticated/anon storage.objects policies are added for these
-- buckets. A signed URL is issued only by the server after authorization.
-- Check for legacy policies that might broadly allow storage.objects access
-- before applying this migration in a nonproduction environment.
