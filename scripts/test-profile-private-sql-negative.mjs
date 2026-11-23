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
// Each attack uses a fresh disposable localhost database and rolls back.
// A direct native Build 8 invoker RPC must NEVER survive country REVOKE as
// an apparently successful Build 9 privacy rollout.
const variants = [
  ['missing-revoke',
   repaired.replace(acl, '-- Negative control: private-column restriction deliberately omitted.'),
   /private column still readable: current_country/],
  ['invoker-owner-helper',
   repaired.replace(acl, 'ALTER FUNCTION hoopcheck_security.own_profile() SECURITY INVOKER;\\n' + acl),
   /Private-column phase 2 requires protected owner\\/MFA projection/],
  ['privileged-public-wrapper',
   repaired.replace(acl, 'ALTER FUNCTION public.get_own_profile() SECURITY DEFINER;\\n' + acl),
   /Private-column phase 2 requires protected owner\\/MFA projection/],
  ['missing-owner-helper-execute',
   repaired.replace(acl, 'REVOKE EXECUTE ON FUNCTION hoopcheck_security.own_profile() FROM authenticated;\\n' + acl),
   /Private-column phase 2 requires protected owner\\/MFA projection/],
];
for (const [name, sql, expected] of variants) {
 const database = `hc_private_negative_${name.replaceAll('-', '_')}_${process.pid}`;
 execFileSync('createdb', [database], { stdio: 'pipe' });
 try {
  assert.notEqual(sql, repaired, `Fixture mutation missing: ${name}`);
  const result = spawnSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-d', database], {input: sql, encoding: 'utf8'});
  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0, `Unsafe phase-2 candidate passed: ${name}`);
  assert.match(result.stderr, expected);
  console.log(`PASS: phase-2 privacy suite rejected ${name}`);
 } finally { execFileSync('dropdb', [database], { stdio: 'pipe' }); }
}
