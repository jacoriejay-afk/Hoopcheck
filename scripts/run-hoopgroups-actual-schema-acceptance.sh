#!/usr/bin/env bash
# Existing disposable restored PostgreSQL 17 only. Not an alternate Step 2 runner.
set -euo pipefail
: "${HOOPCHECK_ACCEPTANCE_SHA:?Supply the exact reviewed group candidate SHA}"
[[ "${HOOPCHECK_LOCAL_ACCEPTANCE:-}" == "on" ]] || { echo "Explicit isolated acceptance required" >&2; exit 1; }
[[ "$(git rev-parse HEAD)" == "$HOOPCHECK_ACCEPTANCE_SHA" ]] || { echo "Wrong source revision" >&2; exit 1; }
[[ "${PGDATABASE:-}" == "hoopcheck_step2_acceptance" ]] || { echo "Wrong database" >&2; exit 1; }
[[ -z "${PGHOSTADDR:-}" && ( "${PGHOST:-}" == /* || "${PGHOST:-}" == "127.0.0.1" || "${PGHOST:-}" == "::1" ) ]] || { echo "Only independently verified local PostgreSQL is permitted" >&2; exit 1; }
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
chmod 600 "$tmp"
cat >"$tmp" <<'SQL'
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'hoopcheck_step2_acceptance' OR current_setting('server_version_num')::integer/10000<>17
 OR (inet_server_addr() IS NOT NULL AND inet_server_addr() NOT IN ('127.0.0.1'::inet,'::1'::inet))
 OR EXISTS(SELECT 1 FROM auth.users) OR EXISTS(SELECT 1 FROM public.hoop_group_posts)
 OR to_regclass('public.hoop_group_post_reads') IS NOT NULL OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='hoop_group_posts' AND column_name='reply_to_id')
 THEN RAISE EXCEPTION 'Refusing non-isolated or non-baseline schema'; END IF;
END $$;
SQL
for f in supabase/candidates/hoopgroups_read_state_review_only.sql supabase/candidates/hoopgroups_replies_review_only.sql supabase/tests/hoopgroups_read_reply_actual_schema.sql; do
  printf 'Source %s ' "$f"
  git show "$HOOPCHECK_ACCEPTANCE_SHA:$f" | sha256sum
  git show "$HOOPCHECK_ACCEPTANCE_SHA:$f" | awk 'tolower($0)!="begin;" && tolower($0)!="commit;"' >>"$tmp"
done
cat >>"$tmp" <<'SQL'
ROLLBACK;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM auth.users) OR EXISTS(SELECT 1 FROM public.hoop_group_posts)
 OR to_regclass('public.hoop_group_post_reads') IS NOT NULL
 OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='hoop_group_posts' AND column_name='reply_to_id')
 THEN RAISE EXCEPTION 'Rollback readback failed'; END IF;
 RAISE NOTICE 'PASS: group candidate rollback and fixture absence';
END $$;
SQL
printf 'Candidate %s\n' "$HOOPCHECK_ACCEPTANCE_SHA"
psql -X --no-password --file="$tmp"
