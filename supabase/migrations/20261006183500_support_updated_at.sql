-- Add admin inbox timestamps for support request status changes
alter table public.support_requests add column if not exists updated_at timestamptz not null default now();
create index if not exists idx_support_requests_updated_at on public.support_requests(updated_at desc);