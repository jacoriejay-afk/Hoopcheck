# Live basketball feed

The production app is [HoopCheck Live Games](https://hoopcheck.online/live-games). It stores fixtures and scores in Supabase and identifies each game by its provider and fixture ID.

## Coverage and data rights

Set server-only `API_SPORTS_APPROVED_BASKETBALL_LEAGUE_IDS` to the comma-separated API-Sports competition IDs covered by documented commercial display and storage rights. Record the approval, scope, evidence, attribution, and any expiration in the Rights & Coverage registry. API-Sports explicitly leaves publication permission to the relevant rights holders. Check existing API-Sports rows against that scope before expanding the feed. [API-Sports terms](https://api-sports.io/terms)

The NBA record lists BALLDONTLIE as a research lead. Its terms permit lawful app display and storage under the provider agreement, with third-party rights addressed separately. The existing protected validation route reports NBA fixture counts and statuses without writing data. Confirm competition rights, team-ID matches, and duplicate handling before enabling imports from any second provider. [BALLDONTLIE terms](https://www.balldontlie.io/terms)

## Schedule and verification

1. Configure approved competition IDs, the API key, and the existing cron bearer secret on the target deployment. Exercise the authenticated sync in a test environment and verify `approvedGamesForDate`, `matchedGames`, and `score_updated_at` for an approved fixture.
2. Use [the Supabase Cron setup SQL](../supabase/candidates/live_basketball_score_cron.sql) to create the job disabled. It targets the production app and installs the HTTP extension in a private schema.
3. Save the endpoint bearer secret in Supabase Vault under `hoopcheck_live_scores_cron_secret`. Set the GitHub Actions repository variable `LIVE_SCORES_SCHEDULER` to `supabase` before enabling the Supabase job. Run one scheduler to stay within the 100-request daily provider budget.
4. Enable `hoopcheck-live-basketball-score-sync` in Supabase Cron. Check the run history for timeouts or non-200 responses and verify that a fixture updates on successive slots. The 96 daily slots include three previous-day checks for late results and seven future-date checks.

To switch back, disable the Supabase job before clearing the GitHub Actions variable. Historical score rows without a confirmed final remain delayed until the provider supplies the result.
