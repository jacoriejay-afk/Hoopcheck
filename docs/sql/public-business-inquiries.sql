-- Deploy only after reviewing project-specific retention and moderation procedures.
-- Private server-only storage: never grant anon/authenticated direct access.
begin;
create table if not exists public.public_business_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (char_length(email) <= 254),
  type text not null check (type in ('sponsor','donate','inquire')),
  message text not null check (char_length(message) between 10 and 3000),
  created_at timestamptz not null default now()
);
-- Supports the rolling 24-hour per-email rate limit without scanning all inquiries.
create index if not exists public_business_inquiries_email_created_idx
  on public.public_business_inquiries (lower(email), created_at desc);
alter table public.public_business_inquiries enable row level security;
revoke all on public.public_business_inquiries from anon, authenticated;
-- No public policies. Access via protected server-side service role only.
commit;
