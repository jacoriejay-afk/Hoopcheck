import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

// Deliberately regress each fix on disposable localhost databases only.
assert.ok(['127.0.0.1', 'localhost', '::1'].includes(process.env.PGHOST));
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function expand(path) {
  return readFileSync(path, 'utf8').split('\n').map(line => line.startsWith('\\ir ')
    ? expand(resolve(dirname(path), line.slice(4))) : line.startsWith('\\set ') ? '' : line).join('\n');
}
const path = resolve(root, 'supabase/migrations/20261119074537_profile_private_field_boundary.sql');
const migration = readFileSync(path, 'utf8');
const suite = expand(resolve(root, 'supabase/tests/profile_private_fields.sql'));
const start = migration.indexOf('create or replace function public.search_public_players(');
const end = migration.indexOf('CREATE OR REPLACE FUNCTION public.search_public_players_page', start);
assert.ok(start > 0 && end > start);
const legacy = migration.slice(start, end);
const cases = [
  ['username', legacy.replace("      or p.username ilike '%' || trim(p_query) || '%'\n", ''), /legacy username search or privacy lost/],
  ['directory', legacy.replace("    and coalesce(p.basketball_type, 'mens') = 'mens'\n", ''), /legacy defaulted men directory changed/],
];
for (const [name, replacement, expected] of cases) {
  assert.notEqual(replacement, legacy);
  run(name, migration.slice(0, start) + replacement + migration.slice(end), expected);
}
run('consent', migration.replace('     AND EXISTS (SELECT 1 FROM hoopcheck_security.player_profile(p_user_id))', ''), /suspended consent leaked/);

function run(name, broken, expected) {
  assert.notEqual(broken, migration);
  const database = `hc_compat_${name}_${process.pid}`;
  execFileSync('createdb', [database], { stdio: 'pipe' });
  try {
    // A callback preserves SQL dollar quotes; replacement strings interpret $$.
    assert.ok(suite.includes(migration));
    const result = spawnSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-d', database], { input: suite.replace(migration, () => broken), encoding: 'utf8' });
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0, `${name} regression escaped the suite`);
    assert.match(result.stderr, expected);
    console.log(`PASS: suite rejects ${name} regression`);
  } finally { execFileSync('dropdb', [database], { stdio: 'pipe' }); }
}
