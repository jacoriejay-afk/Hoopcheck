-- NATIVE-2 media remains server-managed until signed upload and review flows are implemented.
-- No storage.objects policies are created: clients cannot upload, list or download.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('native2-highlights', 'native2-highlights', false, 104857600, array['video/mp4','video/quicktime']),
  ('native2-verification-videos', 'native2-verification-videos', false, 104857600, array['video/mp4','video/quicktime'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;