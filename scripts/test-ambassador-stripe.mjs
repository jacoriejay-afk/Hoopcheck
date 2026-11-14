import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import Stripe from "stripe";

const require = createRequire(import.meta.url);
const moduleUrl = new URL("../lib/ambassador/", import.meta.url);
function compile(source, filename, imports = require) {
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  }, fileName: filename }).outputText;
  const compiled = { exports: {} };
  new Function("require", "exports", "module", js)(imports, compiled.exports, compiled);
  return compiled.exports;
}
const identifiers = compile(await readFile(new URL("identifiers.ts", moduleUrl), "utf8"), "identifiers.ts");
const { recordAmbassadorInvoice, reconcileAmbassadorEvent, updateAmbassadorSubscriptionStatus } = compile(
  await readFile(new URL("stripe.ts", moduleUrl), "utf8"), "stripe.ts",
  name => name === "./identifiers" ? identifiers : require(name),
);
const userId = "10000000-0000-0000-0000-000000000001";
function fixture() {
  const calls = [];
  const rpc = async (name, args) => {
    calls.push({ name, args });
    return { data: true, error: null };
  };
  const charge = {
    id: "ch_1", customer: "cus_1", paid: true, captured: true, amount_captured: 499, amount_refunded: 0,
    currency: "usd", balance_transaction: { currency: "usd", fee: 44 },
    payment_method_details: { card: { fingerprint: "fp_test" } },
  };
  const payment = { amount_paid: 499, currency: "usd", payment: { payment_intent: "pi_1" }, status_transitions: { paid_at: 1700000000 } };
  const stripe = {
    invoicePayments: { list: async () => ({ data: [payment] }) },
    paymentIntents: { retrieve: async () => ({ latest_charge: charge.id }) },
    charges: { retrieve: async () => charge },
    disputes: { list: async () => ({ data: [{ status: "lost", amount: 300 }, { status: "won", amount: 199 }] }) },
  };
  const subscription = { id: "sub_1", customer: "cus_1", status: "active", created: 1700000000,
    metadata: { ambassador_attribution_id: "20000000-0000-0000-0000-000000000001", user_id: userId } };
  const invoice = { id: "in_1", customer: "cus_1", amount_paid: 499, status: "paid", currency: "usd",
    status_transitions: { paid_at: 1700000000 }, total_taxes: [{ amount: 23 }], total_discount_amounts: [{ amount: 50 }] };
  const record = () => recordAmbassadorInvoice(stripe, rpc, invoice, subscription, userId, "pro");
  return { calls, rpc, stripe, charge, invoice, subscription, record };
}

test("Stripe actual receipt, tax and fee are passed separately; discounts are already reflected", async () => {
  const { calls, record } = fixture();
  await record();
  assert.equal(calls.length, 1);
  const { name, args } = calls[0];
  assert.equal(name, "ambassador_record_invoice");
  assert.equal(args.p_gross, 499);
  assert.equal(args.p_tax, 23);
  assert.equal(args.p_fee, 44);
  assert.equal(args.p_discount, 50);
  assert.equal(args.p_deduction, 0);
  assert.match(args.p_fingerprint, /^[a-f\d]{64}$/);
});

test("zero cash, wrong customer and missing attribution do not invoke the ledger", async () => {
  const f = fixture();
  f.invoice.amount_paid = 0;
  await f.record();
  f.invoice.amount_paid = 499;
  f.invoice.customer = "cus_other";
  await f.record();
  f.invoice.customer = "cus_1";
  f.subscription.metadata.ambassador_attribution_id = "forged";
  await f.record();
  assert.deepEqual(f.calls, []);
});

test("missing processor fee fails the event for retry", async () => {
  const f = fixture();
  f.charge.balance_transaction = null;
  await assert.rejects(f.record, /matching charge fee/);
  assert.equal(f.calls.length, 0);
});

test("signed refund and dispute events reconcile current charge using cumulative deductions", async () => {
  const f = fixture();
  const signer = new Stripe("sk_test_fixture");
  const payload = JSON.stringify({ id: "evt_fixture", type: "charge.dispute.updated", data: { object: { charge: "ch_1" } } });
  const secret = "whsec_fixture";
  const signature = signer.webhooks.generateTestHeaderString({ payload, secret });
  assert.throws(() => signer.webhooks.constructEvent(payload, signature, "wrong"));
  const event = signer.webhooks.constructEvent(payload, signature, secret);
  f.charge.amount_refunded = 150;
  f.charge.disputed = true;
  await reconcileAmbassadorEvent(f.stripe, f.rpc, event);
  assert.equal(f.calls[0].name, "ambassador_has_charge");
  assert.equal(f.calls[1].name, "ambassador_reconcile_charge");
  assert.equal(f.calls[1].args.p_deduction, 450);
  f.charge.amount_refunded = 350;
  await reconcileAmbassadorEvent(f.stripe, f.rpc, event);
  assert.equal(f.calls.at(-1).args.p_deduction, 499);
});

test("checkout and cancellation update referral status without generating earnings", async () => {
  const f = fixture();
  f.subscription.cancel_at_period_end = true;
  await updateAmbassadorSubscriptionStatus(f.rpc, f.subscription);
  f.subscription.status = "canceled";
  await updateAmbassadorSubscriptionStatus(f.rpc, f.subscription);
  assert.deepEqual(f.calls.map(call => [call.name, call.args.p_status]), [
    ["ambassador_subscription_status", "cancelling"], ["ambassador_subscription_status", "canceled"],
  ]);
});
