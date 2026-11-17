# NATIVE-2 — foundation and release gates

Status: draft, feature flags off. This branch introduces typed contracts only; no native modules, migrations, buckets, permissions, or production changes.

## Existing integration points inspected
- `apps/mobile/src/lib/supabase.ts`: Expo SecureStore-backed Supabase client.
- `supabase/migrations/20261004190000_harden_player_verification.sql` and owner verification migrations: approval authority must remain server-side.
- `lib/game-availability.ts`: existing chat window is authoritative; do not bypass it for attendance.
- HoopFeed moderation scripts and RLS audit: publishing must use existing server-side entitlements and moderation.

## Proposed database changes (separate reviewed migration)
- `arena_venues`: curated game venue coordinates and verified source; never trust client-supplied venue coordinates.
- `arena_checkins`: user/game unique constraint, server-derived timestamps, verified/rejected state; writes only through authenticated server-side validation with rate limits and anti-spoofing checks.
- `travel_preferences`: user-owned opt-in, country code, foreground/manual mode. Do not store location history or raw coordinates by default.
- `highlight_assets`: owner, private source, processing state, watermark/end-card metadata; publish only when server checks eligibility.
- `verification_video_assets`: private object path linked to existing player verification request, accessible only to owner and authorized reviewers; enforce retention and deletion policy.

## Security and launch gates
1. Review current Supabase table definitions and RLS before writing migration; test on isolated database only.
2. Verify that player/fan attendance does not bypass chat lifecycle, blocking, moderation, or subscription rules.
3. Keep video verification private; no public bucket, public URL, or client-side badge approval.
4. Obtain foreground location and camera/microphone permission only when used; support manual travel selection.
5. Ensure watermark and end card are baked into the rendered export; never mark incomplete processing ready.
6. Install native Expo modules only after version compatibility review; create new EAS build, not OTA.
7. Run mobile typecheck, security tests, CI, iOS/Android physical-device checks, and light/dark QA.
8. Keep all features disabled until independent approval; do not merge or migrate production without verification.
