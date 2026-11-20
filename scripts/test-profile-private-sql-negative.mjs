import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

// CI's disposable local Postgres only. Never infer a hosted database connection.
assert.ok(['127.0.0.1', 'localhost', '::1'].includes(process.env.PGHOST));
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function expand(path) {
  return readFileSync(path, 'utf8').split('\n').map(line => line.startsWith('\\ir ')
    ? expand(resolve(dirname(path), line.slice(4))) : line.startsWith('\\set ') ? '' : line).join('\n');
}
const acl = readFileSync(resolve(root, 'supabase/migrations/20261119075626_restrict_private_profile_columns.sql'), 'utf8');
const repaired = expand(resolve(root, 'supabase/tests/profile_private_fields.sql'));
assert.ok(repaired.includes(acl));
const baseline = repaired.replace(acl, '-- Negative control: private-column restriction deliberately omitted.');
const database = `hc_private_negative_${process.pid}`;
execFileSync('createdb', [database], { stdio: 'pipe' });
try {
  const result = spawnSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-d', database], { input: baseline, encoding: 'utf8' });
  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0, 'The known privacy exposure must fail the regression suite');
  assert.match(result.stderr, /private column still readable: current_country/);
  console.log('PASS: regressions reject the known raw country exposure when only the ACL repair is omitted');
} finally { execFileSync('dropdb', [database], { stdio: 'pipe' }); }
