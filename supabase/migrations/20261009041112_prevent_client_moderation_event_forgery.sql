-- Moderation audit events are written only by trusted server-side moderation routes.
-- Those routes use the server-only service role after validating the moderator's session and role.
-- Remove direct authenticated inserts so clients cannot forge actor IDs or status transitions.

drop policy if exists "moderators can insert moderation events" on public.review_moderation_events;
