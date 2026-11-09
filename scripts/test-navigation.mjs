import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compiled = ts.transpileModule(readFileSync('lib/navigation.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { getRoleNavigation } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const cases = [
  ['player', '/dashboard', '/feed', '/live-games'],
  ['fan', '/team-hub', '/fan-feed', '/fan-live'],
  ['agent', '/agents-hq', '/feed', null],
  ['scout', '/agents-hq', '/feed', null],
  ['manager', '/team-dashboard', null, null],
  ['coach', '/dashboard', null, null],
  ['club_admin', '/dashboard', null, null],
  [null, '/dashboard', null, null],
];
for (const [role, home, feed, live] of cases) {
  const nav = getRoleNavigation(role, true);
  assert.equal(nav.workspace.href, home, role);
  assert.equal(nav.feed?.href ?? null, feed, role);
  assert.equal(nav.live?.href ?? null, live, role);
}
const fan = getRoleNavigation('fan', true);
assert.ok(!fan.tools.some(tool => ['/pre-sign', '/verification', '/connections'].includes(tool.href)));
assert.equal(getRoleNavigation(null, false).workspace.href, '/');
assert.equal(getRoleNavigation(null, false).feed, null);
console.log('PASS: role navigation, unresolved roles fail closed, fan isolation, visitor home. Membership authorization is tested separately.');
