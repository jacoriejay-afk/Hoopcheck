-- Internal moderation notes and account preferences are not public guest profile fields.
-- Preserve authenticated compatibility until owner/staff projections are fully migrated.
revoke select (moderation_note, moderation_updated_by, avatar_moderation_note, research_preferences, notification_preferences) on public.profiles from anon;
