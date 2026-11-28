# Migration reconciliation evidence — QA only

Accepted database candidate: `812bdca9283cf59321bf99e48ea386224af89ffd`. Read-only SQL fingerprint inspection of all 221 ledger entries, no raw SQL or customer data published. All entries contain stored statements. The 404-row CSV and JSON manifest record checksums, content matches, candidate names, historical references and conservative dispositions. The seven duplicate timestamp pairs retain both original file bytes.

- production: 221
- repo_files: 218
- repo_versions: 211
- matching_versions: 35
- production_only: 186
- repo_only: 176
- duplicate_prefixes: 7
- inventory_rows: 404
- content_matched: 76
- unique_content_matched: 76
- ambiguous_content: 0
- historical_only_content_matched: 1
- matching_name_different_version: 93
- matching_name_content_matched: 51
- unmapped_content_matched: 16
- same_version_content_matched: 8

Historical checks sampled three migration-related branches and one older migration-directory commit (see manifest). Branch refs are observed names, not immutable snapshots; file blobs are identified by SHA. The recorded SHA-256 is for PostgreSQL JSONB array text, not the original SQL file. Git SHA-1 comparisons reconstruct candidate bytes using newline, semicolon-newline and double-newline joins with optional matching endings. No nonmatch proves a different SQL effect. Equal content alone does not establish execution ordering, deployment provenance or safe replay. No migration filename was changed and no migration was added.

Remaining: securely export exact stored SQL into restricted offline storage after secret scan; review unmatched statements and historical commit diffs, reconcile all order/dependencies and seed effects, resolve duplicate prefixes in a disposable manifest; replay against reviewed disposable PG17 baseline with catalog/RLS/ACL/function/trigger/storage/data invariant comparisons and Step 1/2 regressions. Do not connect replay to hosted projects. Prior acceptance is preserved; no new actual-schema replay or legal approval is asserted. No production ledger repair or deployment is authorized.

Run the offline verifier against the manifest from this repository checkout: `node scripts/verify-migration-history-evidence.mjs`. It validates coverage and candidate blob bytes; it deliberately never returns release authorization.
