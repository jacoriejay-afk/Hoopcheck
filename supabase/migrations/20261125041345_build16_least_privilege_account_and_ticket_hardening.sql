-- Applied to production on 2026-11-25; preserve migration history.
-- Tighten permissions to match existing RLS policies; privileged RPCs and service role are unchanged.
revoke insert, update, delete, truncate, references, trigger on table public.admin_roles, public.subscriptions from public, anon, authenticated;
revoke select on table public.admin_roles, public.subscriptions from public, anon;
revoke all privileges on table public.player_verification_requests, public.profile_claim_requests from public, anon;
revoke update, delete, truncate, references, trigger on table public.player_verification_requests from authenticated;
revoke delete, truncate, references, trigger on table public.profile_claim_requests from authenticated;
-- New client tickets must start unassigned and unresolved.
alter policy "ticket owner create" on public.support_tickets to authenticated
with check (requester_id = (select auth.uid()) and status = 'open' and assigned_to is null and resolved_at is null);
