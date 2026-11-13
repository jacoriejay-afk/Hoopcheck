# SECURITY-FINAL — production security advisor triage (read-only)

Supabase security advisor inspected 2026-11-12; findings are **warnings, not confirmed exploits**.

- **4 anonymous-callable SECURITY DEFINER RPCs**: `get_public_follow_list`, `get_public_following_count`, `is_team_profile_claimed`, `is_username_available`. Check the function bodies and intentional public-browse behavior before revoking EXECUTE; these may be legitimate public features.
- **35 authenticated-callable SECURITY DEFINER RPCs**: includes `admin_set_membership` and multiple admin operations. An authenticated EXECUTE grant is not itself an authorization bypass when the function checks admin identity; inspect the body of each privileged RPC and test unauthorized calls.
- **6 RLS-enabled tables with no policy** (informational): `fan_live_team_provider_map`, `game_winner_picks`, `public_business_inquiries`, `review_submission_rate_limits`, `stripe_webhook_event_claims`, `team_pay_checkins`. Some may intentionally be server-only. Do not add broad policies merely to clear the lint.

## Release triage

1. **Blocker**: `admin_set_membership` allows moderator role; isolated JWT-based admin/moderator tests for candidate still missing.
2. **Investigate**: anonymous SECURITY DEFINER functions for unintended private-data access; preserve public browsing if intended.
3. **Investigate**: remaining authenticated SECURITY DEFINER admin functions for missing role checks; lint count alone cannot establish vulnerability.
4. **Informational**: RLS tables with no policies are deny-by-default for clients, not automatically insecure.

This document is a read-only advisor snapshot. No SQL mutation or infrastructure provisioning occurred.
