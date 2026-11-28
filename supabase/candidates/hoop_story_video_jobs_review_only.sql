-- REVIEW ONLY. DO NOT APPLY TO PRODUCTION. Requires actual-schema acceptance,
-- private bucket/policy inspection and an approved expiry/cleanup workflow.
begin;
do $$ begin
 if not exists(select 1 from storage.buckets where id='hoopfeed-private-videos' and public=false) then
  raise exception 'Private video bucket missing';
 end if;
end $$;
create table public.hoop_story_video_jobs (
 id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete restrict,
 object_path text not null unique,
 content_type text not null check(content_type in ('video/mp4','video/webm','video/quicktime')),
 size_bytes bigint not null check(size_bytes between 1 and 52428800),
 declared_duration_ms integer not null check(declared_duration_ms between 1 and 60000),
 state text not null default 'awaiting_upload' check(state in ('awaiting_upload','awaiting_moderation')),
 created_at timestamptz not null default now(),
 uploaded_at timestamptz,
 check((state='awaiting_upload' and uploaded_at is null) or (state='awaiting_moderation' and uploaded_at is not null)),
 check(object_path='story-quarantine/'||owner_id::text||'/'||id::text||'.'||case content_type when 'video/mp4' then 'mp4' when 'video/webm' then 'webm' else 'mov' end)
);
alter table public.hoop_story_video_jobs enable row level security;
revoke all on public.hoop_story_video_jobs from public,anon,authenticated;
grant select,insert,update on public.hoop_story_video_jobs to service_role;
create index hoop_story_video_jobs_pending_idx on public.hoop_story_video_jobs(state,created_at);
-- No client storage access, publication, moderation approval or public playback
-- is granted by this candidate. Cleanup must respect outstanding signed tickets.
commit;
