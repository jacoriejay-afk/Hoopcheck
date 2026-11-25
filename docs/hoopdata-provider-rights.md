# HOOPDATA — lawful, budget-controlled expansion
Reviewed public terms 2026-11-25. This is a conservative engineering policy, not legal clearance. No new provider approved or activated.

| Source | Proposed use | Review requirement |
|---|---|---|
| API-Sports | Existing primary | [Terms](https://api-sports.io/terms) do not grant publication licenses. Audit competition-specific rights for existing and new feeds with rights holders. |
| BALLDONTLIE | NBA/WNBA | [Terms](https://www.balldontlie.io/terms.html) permit broad lawful data usage; confirm account entitlement, upstream rights, artwork and privacy separately. |
| Highlightly | Targeted international gaps | [Terms](https://highlightly.net/terms/) and selected plan: confirm commercial user-facing display, caching/retention, aggregation, free-plan coverage and non-wagering predictions in writing. No raw mirrors, bulk replication, limits evasion or logo reuse without rights. |
| TheSportsDB | Directory evaluation | [Terms](https://www.thesportsdb.com/docs_terms_of_use.php): development access is not app-store publication permission. Paid subscription required for published app-store use; no purchase without owner approval. Artwork rights and attribution separately. |
| FIBA GDAP | Authorized competition feeds | [Terms](https://gdap-portal.fiba.basketball/terms-of-services): seek explicit authorization or qualifying contract; contact gdap@fiba.basketball. |
| Eurobasket | Partnership | [Legal](https://www.eurobasket.com/legal.aspx): verify terms directly; no extraction pending written agreement. |
| TeamKeys | Partnership | [Terms](https://teamkeys.net/terms/): no scraping or automated extraction; written license needed. |
| SportsDataverse | Open-source tooling | [Documentation](https://sportsdataverse-py.sportsdataverse.org/docs/intro): software license is not upstream data permission. Approve each dataset/feed separately. |
| Sportradar, Goalserve | Commercial expansion later | Obtain quote, specific coverage and rights before any access or spend. |
| League-direct | Lower divisions, women, undercovered markets | Obtain permission from federation/competition or authorized club for fields, channels, territory, retention and onward display; verify submitter authority and avoid confidential data. |

## Release gate
New source/competition/field/use/plan combinations fail closed until reviewed evidence, upstream rights, approval dates, expiry, attribution, retention and separate image/app-store permissions are recorded. Keep evidence private and auditable. Review actual account quota and forbid overages, key rotation for limit evasion, website scraping and pass-through APIs. Use only official documented endpoints. Source attribution must render when required. Revocation and takedown workflows must suppress affected content and remove expired data, including caches and backups as required by contract. No private player contact information or sensitive data without an appropriate lawful basis. This PR supplies a pure evaluation helper only: trusted records, runtime ingestion/publication/retention gates and operational rights review are future work. Existing production is unchanged; audit existing licenses before expanding.

## Cost-efficient coverage
Start with league-direct agreements and verified manager submissions of authorized fixtures/results, then fill verified gaps with approved feeds. Prioritize Azerbaijan, Portugal, Austria, women's and lower divisions, then South America, Africa and Asia. Keep canonical IDs, deduplicate, cache within approved retention, use season snapshots and quota-aware active windows rather than per-user provider requests. Never assume catalog listing implies current live coverage. Track coverage by league, season, men's/women's category and endpoint. No paid plans or provider requests authorized by this change.
