import Stripe from "stripe";

export type OwnerStripeSummary = {
  currency: string;
  paidInvoices: number;
  activeSubscriptions: number | null;
  subscriptionsIncomplete: boolean;
  refundedMinor: number | null;
  refundsIncomplete: boolean;
  grossPaidMinor: number;
  incomplete: boolean;
  error?: string;
};

export async function getOwnerStripeSummary(): Promise<OwnerStripeSummary> {
  const unavailable: OwnerStripeSummary = { currency: "usd", paidInvoices: 0, activeSubscriptions: null, subscriptionsIncomplete: false, refundedMinor: null, refundsIncomplete: false, grossPaidMinor: 0, incomplete: false, error: "Stripe reporting unavailable" };
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return unavailable;
  const since = Math.floor(Date.now() / 1000) - 30 * 86400;
  try {
    const stripe = new Stripe(key);
    let activeSubscriptions = 0;
    let subscriptionsIncomplete = false;
    let subscriptionCursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const batch = await stripe.subscriptions.list({ status: "active", limit: 100, ...(subscriptionCursor ? { starting_after: subscriptionCursor } : {}) });
      activeSubscriptions += batch.data.length;
      if (!batch.has_more) break;
      subscriptionCursor = batch.data[batch.data.length - 1]?.id;
      if (page === 9 || !subscriptionCursor) subscriptionsIncomplete = true;
    }
    let refundedMinor = 0;
    let refundsIncomplete = false;
    let refundCursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const batch = await stripe.refunds.list({ created: { gte: since }, limit: 100, ...(refundCursor ? { starting_after: refundCursor } : {}) });
      for (const refund of batch.data) {
        if (refund.currency === "usd" && refund.status === "succeeded") refundedMinor += refund.amount;
      }
      if (!batch.has_more) break;
      refundCursor = batch.data[batch.data.length - 1]?.id;
      if (page === 9 || !refundCursor) refundsIncomplete = true;
    }
    let cursor: string | undefined;
    let count = 0;
    let amount = 0;
    let pages = 0;
    // Cap reporting work per page request. If capped, explicitly label the figures partial.
    while (pages < 10) {
      const batch = await stripe.invoices.list({
        status: "paid", created: { gte: since }, limit: 100,
        ...(cursor ? { starting_after: cursor } : {}),
      });
      for (const invoice of batch.data) {
        if (invoice.currency !== "usd") continue;
        count++;
        amount += invoice.amount_paid;
      }
      pages++;
      if (!batch.has_more) return { currency: "usd", paidInvoices: count, activeSubscriptions, subscriptionsIncomplete, refundedMinor, refundsIncomplete, grossPaidMinor: amount, incomplete: false };
      cursor = batch.data.at(-1)?.id;
      if (!cursor) break;
    }
    return { currency: "usd", paidInvoices: count, activeSubscriptions, subscriptionsIncomplete, grossPaidMinor: amount, incomplete: true };
  } catch {
    return unavailable;
  }
}
