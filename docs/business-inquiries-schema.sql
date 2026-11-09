-- Proposed migration; review and apply to the intended HoopCheck environment before enabling inquiries.
create table if not exists public.business_inquiries (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 inquiry_type text not null check (inquiry_type in ('sponsor','investor','strategic','ambassador')),
 contact_name text not null check (char_length(contact_name) between 2 and 120),
 contact_email text not null check (char_length(contact_email) between 3 and 254),
 organization text not null default '',
 message text not null check (char_length(message) between 10 and 3000),
 status text not null default 'new' check (status in ('new','contacted','meeting','proposal','negotiation','signed','declined')),
 consent_at timestamptz not null default now()
);
alter table public.business_inquiries enable row level security;
revoke all on public.business_inquiries from anon, authenticated;
-- No browser role may read or write submissions. A server-side trusted endpoint
-- may insert using a securely held service key after spam and rate-limit checks.
create index if not exists business_inquiries_created_idx on public.business_inquiries(created_at desc);
