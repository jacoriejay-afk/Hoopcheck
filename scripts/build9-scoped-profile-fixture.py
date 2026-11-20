"""Print rollback-only SQL for the isolated test project; never connects to a DB.

Redirect to a reviewed SQL file before executing ONLY on HoopCheck-PR17-Test.
Schema rewriting isolates synthetic tables from installed test-project data.
Server-wide PostgREST hook setup is deliberately omitted (not tested here).
"""
from pathlib import Path
import re


def expand(path):
    source = path.read_text()
    return re.sub(r'^\\ir (.+)$', lambda match: expand(path.parent / match[1]), source, flags=re.M)


root = Path(__file__).resolve().parent.parent
sql = expand(root / 'supabase/tests/profile_private_fields.sql')
sql = re.sub(r'^\\set .*\n', '', sql, flags=re.M)
sql = re.sub(r'DO \$\$ BEGIN\n  IF EXISTS \(\n    SELECT 1 FROM pg_db_role_setting.*?END \$\$;', '', sql, flags=re.S)
sql = re.sub(r'^ALTER ROLE authenticator .*|^NOTIFY pgrst,.*', '', sql, flags=re.M)
for original, temporary in [('public', 'build9_fixture_public'), ('auth', 'build9_fixture_auth'),
                            ('hoopcheck_security', 'build9_fixture_security'),
                            ('storage', 'build9_fixture_storage'), ('realtime', 'build9_fixture_realtime')]:
    sql = re.sub(r'\b' + original + r'\b', temporary, sql)
# Lowercase PUBLIC in a GRANT/REVOKE means the pseudo-role, not the schema.
sql = sql.replace('from build9_fixture_public;', 'from PUBLIC;')
sql = sql.replace('BEGIN;', 'BEGIN;\nCREATE SCHEMA build9_fixture_public;', 1)
assert 'ROLLBACK;' in sql and 'ALTER ROLE authenticator' not in sql
print(sql)
