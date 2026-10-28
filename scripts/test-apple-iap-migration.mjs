import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/20261028120000_add_apple_iap_foundation.sql", import.meta.url),
  "utf8",
);

assert.match(migration, /create table if not exists public\.apple_iap_account_tokens\s*\([\s\S]*?user_id uuid primary key references auth\.users\(id\) on delete cascade/i);
assert.match(migration, /app_account_token uuid not null unique default gen_random_uuid\(\)/i);
assert.match(migration, /notification_uuid uuid primary key/i, "notification IDs must be UUIDs at the database boundary");
assert.match(migration, /alter table public\.apple_iap_account_tokens enable row level security/i);
assert.match(migration, /alter table public\.apple_iap_subscriptions enable row level security/i);
assert.match(migration, /alter table public\.apple_iap_transactions enable row level security/i);
assert.match(migration, /alter table public\.apple_iap_notification_events enable row level security/i);
assert.match(migration, /unique \(environment, original_transaction_id\)/i);
assert.match(migration, /unique \(environment, transaction_id\)/i);
assert.match(migration, /notification_uuid uuid primary key/i);
assert.doesNotMatch(migration, /alter table public\.subscriptions\b/i, "Apple foundation must not modify Stripe's subscriptions table");
assert.doesNotMatch(migration, /create policy\b/i, "no client-facing policies are introduced before a reviewed entitlement API exists");

console.log("Apple IAP migration contract checks passed (static SQL inspection only; no database was contacted).");
