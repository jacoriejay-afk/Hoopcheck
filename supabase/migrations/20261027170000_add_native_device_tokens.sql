-- HoopCheck native push token groundwork.
-- Device tokens are written only by trusted server routes using the service role.
-- Do not add client INSERT/UPDATE policies: a token must be associated with the
-- authenticated HoopCheck account on the server, never with a client-supplied user ID.

create table if not exists public.native_device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  provider text not null check (provider in ('apns', 'fcm')),
  device_token text not null,
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint native_device_tokens_provider_platform_check check (
    (platform = 'ios' and provider = 'apns') or
    (platform = 'android' and provider = 'fcm')
  ),
  constraint native_device_tokens_provider_token_unique unique (provider, device_token)
);

create index if not exists native_device_tokens_user_active_idx
  on public.native_device_tokens (user_id, active)
  where active = true;

alter table public.native_device_tokens enable row level security;

-- Deliberately no authenticated-user policies. Device tokens are sensitive
-- routing identifiers and are managed by server-side registration/logout flows.
comment on table public.native_device_tokens is
  'Native APNs/FCM device tokens; service-role-only access. Server routes must bind tokens to the verified session user, rotate tokens, and deactivate on logout.';
comment on column public.native_device_tokens.device_token is
  'APNs or FCM token. Never expose this value in public APIs or logs.';
