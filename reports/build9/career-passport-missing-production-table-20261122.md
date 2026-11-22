# Career Passport production dependency — isolated remediation review

Date: 2026-11-22. **NO production activation.**

## Verified root cause

Read-only catalog on production Supabase `HoopCheck` (`ucbdceaieyenljcwlhnj`) returned `to_regclass('public.player_career_stops') = null`.
The same table is absent from the separate `HoopCheck-PR17-Test` project.
Both environments have `profiles`, `teams` and `subscriptions` tables.
The deployed `PlayerJourney` component already queries `player_career_stops`, so UI-only fixes cannot make Career Passport load/save.

## Prepared isolated candidate

`supabase/candidates/player_career_stops_isolated_review_only.sql` contains **only** the Career Passport table, one index, explicit grants, RLS-enabled private-by-default reads and the existing Premium Player owner-only insert/update/delete requirement. It does **not** replay the old `20261019140000_trust_journey_claims_live_hub.sql` migration, which also changes unrelated review, country-consent, and live-game behavior. No security-definer function, policy weakening, new privilege on an existing table, or data backfill is included.

## Isolated test

On `HoopCheck-PR17-Test`, used a transaction-scoped copy of the exact candidate with `COMMIT` replaced by catalog checks + `ROLLBACK`; all SQL statements completed without an error. The final `to_regclass('public.player_career_stops')` result was **null**. Thus the test leaves no table, rows or grants behind.

This is SQL syntax/rehearsal evidence only, **not** signed HTTP/JWT proof of owner/nonowner reads/writes. Those remain unverified.

## Preconditions for production activation

1. Reconcile with all migrations recorded on production, including any other historical career history contract and current grants. Confirm the two relevant FK references, membership entitlements, and publisher visibility behavior on the production-equivalent schema.
2. Create a reviewed, properly versioned *additive* migration through the standard migration workflow with an approved rollback/handoff. Preserve existing function ownership, privacy policies, legacy Build 7/8 compatibility and provider-specific membership logic.
3. Test real authenticated Premium owner inserts, private reads, public opt-in reads, edits, delete, manual team mapping; test Pro/Free/non-owner/anon denial and malformed team references. Do not treat synthetic SQL roles as equivalent to real sessions.
4. Confirm production deployment authorization before running SQL. Do not apply the candidate directly from this report or bypass the separate Build 9 backend release gate.
5. After rollout, test on a signed-in iPhone, verify no errors and no accidental public rows. If a production rollback is required later, disable career writes/feature display first and preserve user entries. **Never drop populated tables as an emergency rollback.**

## HoopGroups remains separate

Production `public.hoop_group_spaces` and `public.hoop_group_channels` are also absent. The staging-only HoopGroups V1/V2 candidates require their own moderation/security acceptance and feature flags. This Career Passport candidate must not be used to activate HoopGroups.
