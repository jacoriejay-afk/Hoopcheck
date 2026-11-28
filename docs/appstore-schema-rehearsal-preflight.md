# Compliance database rehearsal preflight

Status: **BLOCKED — schema alignment not yet performed.** No hosted database mutation, data copy, paid branch, or reset is authorized by this work.

The recorded production/test snapshots in appstore-schema-parity-snapshot.json contain only public catalog metadata. They have 108/46 tables respectively, 67 missing in test, 5 test-only, 13 shared-table count/security differences. Migration histories contain 221/53 entries with no exact version overlap and only 9 shared names. The candidate repository has historical SQL but no verified complete bootstrap baseline. Replaying all production migrations or marking their versions applied would be unsafe.

Run the read-only query in supabase/tests/appstore_schema_catalog_readonly.sql separately in both verified environments; save returned rows into a new format-1 JSON snapshot. Run:

    python3 scripts/test-appstore-schema-parity.py -v
    python3 scripts/appstore-schema-parity.py docs/appstore-schema-parity-snapshot.json

Exit 1 means structural drift, 2 means invalid evidence, 0 means counts match only. None grants production or rehearsal authorization. CI passes when the checker correctly detects the recorded mismatch, not when database parity is achieved.

## Required next acceptance

1. Obtain an authorized schema-only dump using trusted Supabase CLI / pg_dump in an isolated environment, covering application schemas, functions, ownership, views, policies, constraints, grants, indexes and dependencies. Exclude real user records, sensitive role credentials and secret-bearing configuration; review function bodies for embedded secrets before sharing a dump. Recreate managed Auth/Storage services using supported local Supabase tooling, not raw copying of managed Auth data.
2. Restore into a NEW disposable local or explicitly approved test database, never reset the existing test fixture project. Verify target identity and no production connection/keys. No paid branch creation without separate approval.
3. Compare full definitions and privileges to the reviewed schema baseline; counts are not enough. Account for test-only objects explicitly. Do not assume migration-name equivalence.
4. Reconcile actual applied history and candidate dependency order. Review opt-in MFA, StoreKit, account-deletion ledger, Apple pending signup/vault/gate, worker and cleanup candidates. Generate actual migrations with supported CLI after rehearsal. No activation flags or real provider calls.
5. Run positive and negative integration tests with synthetic accounts; exercise RLS/MFA, membership precedence, freeze, scheduled revocation, Apple revocation, complete erasure and confirmation. Rehearse rollback/recovery without live user data.
6. Require separately approved retention rules, complete worker effects, provider setup, signed device acceptance and deployment authorization. Do not mark #1073 complete from this audit.

The existing project is a divergent fixture environment, not a production-equivalent staging database. This change provides a reproducible preflight, not a complete migration rehearsal.

## Baseline and ledger handoff

The database owner and an independent reviewer must provide the following artifacts through an approved private channel. Pin all artifacts to the same read-only catalog snapshot and record the source environment identity, UTC capture time, PostgreSQL 17 minor version, export tool and version, schema include and exclude list, and SHA-256 of each reviewed artifact.

- Schema-only PostgreSQL export for the application-owned schemas and dependencies. Include table and column definitions, generated values, sequences, constraints and foreign keys, indexes, views, functions, triggers, comments relevant to security, RLS and forced-RLS flags and policies, object ownership, role memberships, object grants and default grants.
- Managed-service contract for the required Auth, Storage and Realtime objects, role names, extensions and versions, publications, bucket configuration, and relevant cron job definitions with credentials and destinations redacted. Record which definitions the local service must supply and how each managed dependency was checked.
- Applied migration ledger from the same source snapshot. Include every applied version, name where recorded, and a checksum or reviewed source mapping where available. Document manually applied deltas and unresolved mappings separately. Supply the pinned Git commit and file inventory for the forward-only guard.
- Reviewer confirmation that the artifacts contain schema and operational metadata only. Exclude account rows, credentials, API keys, role passwords, signed URLs, storage object payloads, raw webhooks, and secret-bearing SQL configuration.

Restore the reviewed baseline into a new network-isolated PostgreSQL 17 environment with local Auth and Storage equivalents. Compare object definitions and privileges before applying candidate migrations. Classify ledger discrepancies by inspected source and effective schema, and use a new forward migration for reviewed corrections. Keep applied historical files and ledger entries intact. Record baseline and candidate digests, the migration sequence, fixture outcomes, elapsed restore time, and the synthetic recovery point.
