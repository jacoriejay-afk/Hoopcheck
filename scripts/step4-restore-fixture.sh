#!/usr/bin/env bash
# CI-only fixture roundtrip; not a full HoopCheck schema or hosted backup rehearsal.
set -euo pipefail
[[ "${CI:-}" == true && "${GITHUB_ACTIONS:-}" == true ]] || { echo 'GitHub Actions disposable service required'; exit 1; }
container="${STEP4_POSTGRES_CONTAINER:-}"
[[ "$container" =~ ^[0-9a-f]{64}$ ]] || { echo 'Missing isolated PostgreSQL service container ID'; exit 1; }
[[ "$(docker inspect --format '{{.Config.Image}}' "$container")" == postgres:16 ]] || { echo 'Expected PostgreSQL 16 service'; exit 1; }
src="hoopcheck_step4_fixture_source"
dst="hoopcheck_step4_fixture_restore"
psql_cmd=(docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres)
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
docker exec "$container" createdb -U postgres "$src"
docker exec "$container" createdb -U postgres "$dst"
"${psql_cmd[@]}" -d "$src" <<'SQL'
CREATE TABLE public.fixture_account(id integer primary key);
CREATE TABLE public.fixture_event(id integer primary key, account_id integer not null references public.fixture_account(id), event_key text unique not null);
INSERT INTO public.fixture_account VALUES (1),(2);
INSERT INTO public.fixture_event VALUES (1,1,'synthetic-event');
ALTER TABLE public.fixture_event ENABLE ROW LEVEL SECURITY;
CREATE POLICY fixture_owner ON public.fixture_event FOR SELECT USING (account_id = 1);
SQL
docker exec "$container" pg_dump -U postgres -Fc "$src" > "$tmp/fixture.dump"
docker exec -i "$container" pg_restore -U postgres --exit-on-error -d "$dst" < "$tmp/fixture.dump"
"${psql_cmd[@]}" -d "$dst" <<'SQL'
DO $$ BEGIN
 IF (SELECT count(*) FROM public.fixture_account) <> 2 OR (SELECT count(*) FROM public.fixture_event WHERE event_key='synthetic-event' AND account_id=1) <> 1 THEN RAISE EXCEPTION 'restored data mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.fixture_event'::regclass AND relrowsecurity) OR NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='fixture_event' AND policyname='fixture_owner') THEN RAISE EXCEPTION 'restored RLS metadata missing'; END IF;
 BEGIN INSERT INTO public.fixture_event VALUES (2,1,'synthetic-event'); RAISE EXCEPTION 'unique constraint missing'; EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN INSERT INTO public.fixture_event VALUES (2,999,'new-event'); RAISE EXCEPTION 'foreign key missing'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END $$;
SQL
echo 'Synthetic PostgreSQL roundtrip passed; full-schema recovery remains unverified'
