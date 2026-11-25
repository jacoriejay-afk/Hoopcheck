-- These internal fields have no direct client read consumer.
-- Keep research preference writes and staff moderation RPCs available.
-- Existing owner-facing notice and notification reads remain until owner projection cutover.
revoke select (moderation_updated_by, avatar_moderation_note, research_preferences) on public.profiles from authenticated;
