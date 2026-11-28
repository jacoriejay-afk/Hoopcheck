# Live basketball feed

The production app is [HoopCheck Live Games](https://hoopcheck.online/live-games). It stores fixtures and scores in Supabase and identifies each game by its provider and fixture ID.

## Coverage and data rights

Set server-only `API_SPORTS_APPROVED_BASKETBALL_LEAGUE_IDS` to the comma-separated API-Sports competition IDs covered by documented commercial display and storage rights. Record the approval, scope, evidence, attribution, and any expiration in the Rights & Coverage registry. API-Sports explicitly leaves publication permission to the relevant rights holders. Check existing API-Sports rows against that scope before expanding the feed. [API-Sports terms](https://api-sports.io/terms)

The NBA record lists BALLDONTLIE as a research lead. Its terms permit lawful app display and storage under the provider agreement, with third-party rights addressed separately. The existing protected validation route reports NBA fixture counts and statuses without writing data. Confirm competition rights, team-ID matches, and duplicate handling before enabling imports from any second provider. [BALLDONTLIE terms](https://www.balldontlie.io/terms)

## Isolated acceptance

- Keep provider flags and credentials unset on QA. The route requires an authorized caller and approved competition IDs before any provider fetch.
- Import fixtures only through active provider team mappings. A reviewed mapping needs the canonical club, competition, season and provider identity. An unmatched or inactive mapping needs independent review before activation.
- Verify filter exclusions, timestamp and status corrections, duplicate fixtures, and stale scores against mocked responses. The 96 existing daily slots include three previous-day checks and seven future-date checks. Each invocation still requests one date.
- Before activating real coverage, obtain competition-specific display and storage rights, a reviewed mapping ledger, disposable acceptance credentials and the owner's separate release approval. Test reported coverage, timestamp changes and cadence with that approved provider. Any scheduler change requires its own rollout decision.
