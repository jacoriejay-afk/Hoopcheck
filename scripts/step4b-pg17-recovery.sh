#!/usr/bin/env bash
# CI-only synthetic application migration subsets, never a hosted schema dump.
set -euo pipefail
[[ "${CI:-}" == true && "${GITHUB_ACTIONS:-}" == true ]] || exit 1
container="${STEP4_POSTGRES_CONTAINER:-}"
[[ "$container" =~ ^[0-9a-f]{64}$ ]] || exit 1
[[ "$(docker inspect --format '{{.Config.Image}}' "$container")" == postgres:17 ]] || exit 1
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
python3 - "$tmp" <<'PY'
from pathlib import Path
import sys
target=Path(sys.argv[1])
for name in ("storekit_membership_isolated","opted_in_mfa"):
    source=Path("supabase/tests") / (name+".sql")
    lines=source.read_text().splitlines()
    assert lines.count("ROLLBACK;")==1 and lines[-2]=="ROLLBACK;" and "fixtures rolled back" in lines[-1], "Unexpected fixture terminal rollback; review before reuse"
    lines[-2]="COMMIT;"
    lines[-1]="SELECT 'Synthetic fixture committed only for disposable restore' AS result;"
    (target/(name+".sql")).write_text("\n".join(lines)+"\n")
PY
docker exec "$container" mkdir -p /repo
docker cp supabase "$container":/repo/supabase
for name in storekit_membership_isolated opted_in_mfa; do
 src="step4b_${name}_source"
 dst="step4b_${name}_restore"
 docker cp "$tmp/$name.sql" "$container":/repo/supabase/tests/step4b_generated.sql
 docker exec "$container" createdb -U postgres "$src"
 docker exec "$container" createdb -U postgres "$dst"
 docker exec "$container" psql -X -U postgres -v ON_ERROR_STOP=1 -d "$src" -f /repo/supabase/tests/step4b_generated.sql
 started=$SECONDS
 docker exec "$container" pg_dump -U postgres -Fc "$src" > "$tmp/$name.dump"
 docker exec -i "$container" pg_restore -U postgres --exit-on-error -d "$dst" < "$tmp/$name.dump"
 echo "Synthetic $name dump+restore elapsed_seconds=$((SECONDS-started))"
 for db in "$src" "$dst"; do
  docker exec "$container" psql -X -U postgres -At -v ON_ERROR_STOP=1 -d "$db" -c "SELECT n.nspname,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth','private','storage','realtime','hoopcheck_billing','hoopcheck_security') AND c.relkind IN ('r','v','p') ORDER BY 1,2;" > "$tmp/$db.catalog"
 done
 diff -u "$tmp/$src.catalog" "$tmp/$dst.catalog"
 if [[ "$name" == storekit_membership_isolated ]]; then
 docker exec -i "$container" psql -X -U postgres -v ON_ERROR_STOP=1 -d "$dst" <<'SQL'
BEGIN;
DO $$ BEGIN
 IF (SELECT count(*) FROM auth.users)<>3 OR (SELECT count(*) FROM public.subscriptions)<>1 OR (SELECT stripe_subscription_id FROM public.subscriptions)<>'sub_fixture' THEN RAISE EXCEPTION 'membership fixture rows changed'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111","aal":"aal1"}',true);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.apple_memberships) OR EXISTS(SELECT 1 FROM public.membership_entitlements) THEN RAISE EXCEPTION 'restored MFA bypass'; END IF; END $$;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"22222222-2222-4222-8222-222222222222","aal":"aal1"}',true);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.apple_memberships) OR EXISTS(SELECT 1 FROM public.membership_entitlements) THEN RAISE EXCEPTION 'restored cross-user leak'; END IF; END $$;
RESET ROLE;
ROLLBACK;
SQL
 else
 docker exec -i "$container" psql -X -U postgres -v ON_ERROR_STOP=1 -d "$dst" <<'SQL'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111","aal":"aal1"}',true);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.private_items) OR EXISTS(SELECT 1 FROM storage.objects) OR EXISTS(SELECT 1 FROM realtime.messages) THEN RAISE EXCEPTION 'restored MFA bypass'; END IF; END $$;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111","aal":"aal2"}',true);
DO $$ BEGIN IF (SELECT count(*) FROM public.private_items)<>1 OR (SELECT count(*) FROM storage.objects)<>1 OR (SELECT count(*) FROM realtime.messages)<>1 THEN RAISE EXCEPTION 'restored ownership or storage/realtime access changed'; END IF; END $$;
RESET ROLE;
ROLLBACK;
SQL
 fi
done
echo 'PG17 application subset roundtrips passed; cluster roles shared and full schema, actual object bytes and provider recovery unverified.'
