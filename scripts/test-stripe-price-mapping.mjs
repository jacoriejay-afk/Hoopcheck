import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const route = readFileSync(new URL('../app/api/stripe/webhook/route.ts', import.meta.url), 'utf8');
const source = route.slice(route.indexOf('function getPlanFromPrice'), route.indexOf('async function verifyIdentitySessionOwner'));
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const load = (env) => new Function('process', `${js}; return { getPlanFromPrice, getBillingInterval };`)({ env });

test('all six configured prices resolve their tier and term without subscription metadata', () => {
  const env = {};
  for (const tier of ['pro', 'premium']) {
    for (const suffix of ['', '_6_MONTH', '_YEAR']) env[`STRIPE_${tier.toUpperCase()}${suffix}_PRICE_ID`] = `${tier}${suffix}`;
  }
  const policy = load(env);
  for (const tier of ['pro', 'premium']) {
    for (const [suffix, term] of [['', 'month'], ['_6_MONTH', '6_month'], ['_YEAR', 'year']]) {
      assert.equal(policy.getPlanFromPrice(`${tier}${suffix}`), tier);
      assert.equal(policy.getBillingInterval(`${tier}${suffix}`), term);
    }
  }
});

test('absent IDs cannot match absent environment variables; metadata fallback is preserved', () => {
  const policy = load({});
  assert.equal(policy.getPlanFromPrice(undefined), null);
  assert.equal(policy.getBillingInterval(undefined), 'month');
  assert.equal(policy.getBillingInterval(undefined, undefined, { billing_interval: '6_month' }), '6_month');
  assert.equal(policy.getPlanFromPrice('price_unmapped', { plan: 'pro' }), 'pro');
  assert.equal(policy.getPlanFromPrice('price_unmapped', { plan: 'invalid' }), null);
});
