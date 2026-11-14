-- REELS-1 / SECURITY-FINAL: protect profile privilege fields.
-- NOT DEPLOYED. Validate all client profile editor payloads before applying.
-- Table-level UPDATE must be revoked: column REVOKE alone is insufficient.
begin;
revoke update on table public.profiles from authenticated;
grant update (
  display_name, avatar_url, country, bio, position, years_pro,
  current_country, current_team, profile_visibility, first_name, last_name,
  professional_experience, username, interests, favorite_leagues,
  favorite_teams, experience_summary, basketball_type, free_agent,
  hometown, nationality, selected_team_id, selected_womens_team_id,
  experience_goal, research_preferences, theme_preference,
  preferred_language, notification_preferences, current_country_public,
  preferred_basketball_side, height, last_seen_at
) on table public.profiles to authenticated;
-- Deliberately exclude: account_type, player_verified, coach_verified,
-- profile_claimed, selected_team_verified, identity_verification_status,
-- stripe_identity_verification_session_id, moderation fields, timestamps,
-- birthdate, gender, and other identity/privilege metadata.
-- NOTE: onboarding_completed is referenced in UI but absent from current
-- production profile schema; investigate before migration.
commit;
