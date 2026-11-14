import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { uuidPattern } from "./identifiers";

type Rpc = (name: string, args: Record<string, unknown>) => PromiseLike<{
  data: unknown;
  error: { message: string } | null;
}>;

function objectId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id;
}

async function runRpc(rpc: Rpc, name: string, args: Record<string, unknown>) {
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(`Ambassador ledger operation ${name} failed: ${error.message}`);
  return data;
}

async function chargeDeductions(stripe: Stripe, charge: Stripe.Charge, checkedAt: string) {
  const chargeId = charge.id;
  const disputes = charge.disputed ? await stripe.disputes.list({ charge: chargeId, limit: 100 }) : null;
  if (disputes?.has_more) throw new Error("Unexpected number of disputes for a charge");
  const held = disputes?.data
    .filter(({ status }) => status === "needs_response" || status === "under_review" || status === "lost")
    .reduce((total, dispute) => total + dispute.amount, 0) ?? 0;

  return {
    p_deduction: Math.min(charge.amount_captured, charge.amount_refunded + held),
    p_reason: disputes?.data.length ? "dispute" : "refund",
    p_checked_at: checkedAt,
  };
}

export async function recordAmbassadorInvoice(
  stripe: Stripe, rpc: Rpc, invoice: Stripe.Invoice, subscription: Stripe.Subscription,
  userId: string, plan: "pro" | "premium" | null,
) {
  const attribution = subscription.metadata.ambassador_attribution_id;
  const customer = objectId(invoice.customer);
  if (!attribution || !uuidPattern.test(attribution) || !uuidPattern.test(userId) || !plan ||
      !customer || customer !== objectId(subscription.customer) ||
      invoice.status !== "paid" || invoice.amount_paid <= 0 || invoice.currency !== "usd" ||
      !invoice.status_transitions.paid_at) return;

  // HoopCheck Checkout produces one Stripe payment per invoice. Credits and
  // out-of-band payments have no verified processor receipt to commission.
  const payments = await stripe.invoicePayments.list({ invoice: invoice.id, status: "paid", limit: 2 });
  if (payments.data.length !== 1 || payments.has_more) return;
  const payment = payments.data[0];
  if (payment.amount_paid !== invoice.amount_paid || payment.currency !== invoice.currency) return;
  const intentId = objectId(payment.payment.payment_intent);
  const chargeId = objectId(payment.payment.charge) ??
    (intentId ? objectId((await stripe.paymentIntents.retrieve(intentId)).latest_charge) : undefined);
  if (!chargeId) return;
  const checkedAt = new Date().toISOString();
  const charge = await stripe.charges.retrieve(chargeId, { expand: ["balance_transaction"] });
  if (!charge.paid || !charge.captured || charge.amount_captured !== invoice.amount_paid ||
      charge.currency !== invoice.currency || objectId(charge.customer) !== customer) return;
  const balance = charge.balance_transaction;
  if (!balance || typeof balance === "string" || balance.currency !== invoice.currency) {
    throw new Error("Stripe has not provided the matching charge fee");
  }

  const card = charge.payment_method_details?.card;
  const bank = charge.payment_method_details?.us_bank_account;
  const paymentFingerprint = card?.fingerprint ?? bank?.fingerprint;
  const fingerprint = paymentFingerprint
    ? createHash("sha256").update(`${card ? "card" : "bank"}:${paymentFingerprint}`).digest("hex")
    : null;
  await runRpc(rpc, "ambassador_record_invoice", {
    ...await chargeDeductions(stripe, charge, checkedAt),
    p_attribution: attribution, p_user: userId, p_customer: customer, p_subscription: subscription.id,
    p_invoice: invoice.id, p_charge: chargeId, p_currency: invoice.currency, p_plan: plan,
    p_paid_at: new Date((payment.status_transitions.paid_at ?? invoice.status_transitions.paid_at) * 1000).toISOString(),
    p_gross: invoice.amount_paid,
    p_tax: invoice.total_taxes?.reduce((sum, tax) => sum + tax.amount, 0) ?? 0,
    p_fee: balance.fee,
    // amount_paid already reflects discounts.
    p_discount: invoice.total_discount_amounts?.reduce((sum, discount) => sum + discount.amount, 0) ?? 0,
    p_fingerprint: fingerprint,
    p_fraud: charge.fraud_details?.stripe_report === "fraudulent" ||
      charge.fraud_details?.user_report === "fraudulent" ||
      charge.outcome?.risk_level === "highest" || Boolean(charge.review),
  });
}

export async function reconcileAmbassadorEvent(stripe: Stripe, rpc: Rpc, event: Stripe.Event) {
  let chargeId: string | undefined;
  switch (event.type) {
    case "charge.refunded":
      chargeId = event.data.object.id;
      break;
    case "refund.created":
    case "refund.updated":
    case "refund.failed":
    case "charge.dispute.created":
    case "charge.dispute.updated":
    case "charge.dispute.closed":
    case "charge.dispute.funds_withdrawn":
    case "charge.dispute.funds_reinstated":
      chargeId = objectId(event.data.object.charge);
      break;
    default:
      return;
  }
  if (!chargeId || !await runRpc(rpc, "ambassador_has_charge", { p_charge: chargeId })) return;
  const checkedAt = new Date().toISOString();
  const charge = await stripe.charges.retrieve(chargeId);
  await runRpc(rpc, "ambassador_reconcile_charge", {
    p_charge: chargeId, ...await chargeDeductions(stripe, charge, checkedAt),
  });
}

export async function updateAmbassadorSubscriptionStatus(
  rpc: Rpc, subscription: Stripe.Subscription,
) {
  const id = subscription.metadata.ambassador_attribution_id;
  const userId = subscription.metadata.user_id;
  if (!id || !uuidPattern.test(id) || !userId || !uuidPattern.test(userId)) return;
  await runRpc(rpc, "ambassador_subscription_status", {
    p_id: id, p_user: userId, p_subscription: subscription.id,
    p_customer: objectId(subscription.customer),
    p_status: subscription.cancel_at_period_end && subscription.status === "active"
      ? "cancelling" : subscription.status,
    p_created_at: new Date(subscription.created * 1000).toISOString(),
  });
}
