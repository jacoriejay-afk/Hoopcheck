# Build 8 production application-catalog rehearsal

Completed locally on PostgreSQL 17.12 with metadata read from production 17.11
on 2026-11-19. No production records, credentials or database files were copied.

The protected export contains 101 table definitions (all public application
relations plus auth.users, auth.mfa_factors, storage.objects, realtime.messages),
110 function definitions, enums/generated columns, applicable constraints, public
application triggers, row policies, table/column/function/schema ACLs, 27 role
memberships and 300 default-privilege entries. Applicable authenticator/database
settings contained no conflicting pre-request hook. Actual public subscriptions
and profile definitions were used rather than simplified fixture tables.

This is an application migration/security rehearsal, not a complete hosted
Supabase restore: platform services, other Auth/Storage/Realtime relations,
partition routing, platform-owned triggers, nonconstraint indexes, extension
binaries and historical user data are not reproduced. Cross-platform/live Auth,
Storage, Realtime, payment and performance smoke tests still need staging.

## Findings and fix

The previous privacy migration failed against production's real legacy search
signature: `cannot remove parameter defaults from existing function`. Retaining
those defaults also made positional calls ambiguous with the new username RPC.
The unapplied migrations now preserve the deployed five-argument API/defaults
and use `search_public_players_by_username` for new username clients. Native/web
clients and fixtures use the distinct name. No production function is dropped.
Zero-argument, positional partial and full legacy calls remain tested. The
existing CI fixture now creates the actual defaulted legacy signature before
applying the migration, so this failure cannot hide behind a missing function.

All five migrations pass sequentially against the restored catalog. Synthetic
checks pass for direct private-column denial, masked username/legacy/paged search,
owner-only profile reads/edits, cross-owner denial, real subscription RLS and
Stripe Premium access, AAL1 MFA denial/AAL2 recovery, and rejection of client Apple
enablement. Seeded teams, approved reviews and raw Stripe records are preserved
byte-for-byte; commission tables remain unchanged. Commission invoice/refund
behavior is separately covered by existing isolated SQL/backend tests.

The entire rehearsal runs in one transaction and rolls back. Afterward profiles
count is zero and neither the new username RPC nor Apple tables exist. This
checks rollback of the isolated migration transaction; it does not replace the
approved post-deployment compensating rollback plan in the release report.

## Repeat safely

Use a protected local folder outside Git; metadata can contain internal function
constants. Never commit the JSON exports or generated restore SQL. Configure the
read-only database service privately; do not put connection secrets in commands.
From the repository root, an owner with a configured read-only service can export:

```sh
umask 077
mkdir -p /tmp/hoop-build8-catalog
PGSERVICE=hoopcheck_readonly psql -XAt -v ON_ERROR_STOP=1 \
  -f supabase/tests/build8_catalog_snapshot.sql \
  > /tmp/hoop-build8-catalog/snapshot.json
PGSERVICE=hoopcheck_readonly psql -XAt -v ON_ERROR_STOP=1 \
  -f supabase/tests/build8_catalog_extras.sql \
  > /tmp/hoop-build8-catalog/extras.json
python3 scripts/rehearse-build8-catalog.py \
  /tmp/hoop-build8-catalog/snapshot.json \
  /tmp/hoop-build8-catalog/extras.json \
  /tmp/hoop-build8-catalog/restore.sql
```

The exports are SELECT-only. The generator writes local DDL; **never apply that
DDL to a hosted database**. Create a fresh disposable PostgreSQL 17 container
with no published ports and no network, mounting this repository read-only:

```sh
docker run -d --name hoop-build8-rehearsal --network none \
  -e POSTGRES_PASSWORD=build8-local-only -v "$PWD:/repo:ro" postgres:17
# Wait for pg_isready to succeed, then:
docker exec hoop-build8-rehearsal createdb -U postgres hoop_prod_rehearsal
docker cp /tmp/hoop-build8-catalog/restore.sql hoop-build8-rehearsal:/tmp/restore.sql
docker exec hoop-build8-rehearsal psql -X -v ON_ERROR_STOP=1 -U postgres \
  -d hoop_prod_rehearsal -f /tmp/restore.sql
docker exec -w /repo hoop-build8-rehearsal psql -X -v ON_ERROR_STOP=1 -U postgres \
  -d hoop_prod_rehearsal -f supabase/tests/build8_production_catalog_rehearsal.sql
```

Stop on any restore error; do not run tests against a partial restore. The test
also refuses databases other than `hoop_prod_rehearsal` or a TCP connection.
To clean up only this disposable test container:
`docker rm -f hoop-build8-rehearsal`.

Protected snapshot SHA-256:
`aee57005c738377e6c1fe9b3e81b34623679a7f017cdda225afc43039f132314`.
Extras SHA-256:
`03e8ad63d30b0565bfc78d71488a1f6762ce7b1f1d93c98f57d3301fd739f395`.
Execution logs for this session: `/tmp/hoop-catalog-restore.log` and
`/tmp/hoop-prod-catalog-rehearsal.log`. No protected snapshot content is included
in this repository. Refresh/rehearse if the target schema changes before approval.
