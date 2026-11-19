import type Stripe from "stripe";

/**
 * Only a verified, expired subscription Checkout Session with no subscription
 * attached can be considered for releasing an unredeemed reservation.
 * This policy is intentionally conservative: unknown states stay locked.
 * Caller must retrieve the session directly from Stripe using server credentials
 * and verify the session's account/user binding independently.
 */
export function canReleaseExpiredTrialSession(
  session: Pick<Stripe.Checkout.Session,
    "status" | "mode" | "subscription" | "payment_status" | "metadata" | "client_reference_id">,
  userId: string,
  expectedSessionId: string,
  actualSessionId: string
): boolean {
  return Boolean(userId) &&
    expectedSessionId === actualSessionId &&
    actualSessionId.startsWith("cs_") &&
    session.mode === "subscription" &&
    session.status === "expired" &&
    session.subscription == null &&
    session.payment_status === "unpaid" &&
    session.client_reference_id === userId &&
    session.metadata?.user_id === userId &&
    session.metadata?.stripe_trial_reserved === "true";
}
