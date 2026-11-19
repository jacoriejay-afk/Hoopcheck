import type Stripe from "stripe";

/**
 * Only a verified, expired subscription Checkout Session with no subscription
 * attached can be considered for marking an unredeemed reservation permanently expired.
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

/**
 * Server-only reconciliation primitive. Callers must obtain the reservation
 * owner and bound session from the service-role database, never user input.
 * This function does not run automatically and must not be exposed publicly.
 * Fail closed on Stripe errors, unexpected state, or database RPC errors.
 */
export async function reconcileExpiredTrialReservation(
  userId: string,
  boundSessionId: string,
  retrieveSession: (id: string) => Promise<Stripe.Checkout.Session>,
  markExpiredClaim: (userId: string, sessionId: string) => Promise<boolean>
): Promise<"expired" | "retained"> {
  if (!userId || !boundSessionId.startsWith("cs_")) return "retained";
  const session = await retrieveSession(boundSessionId);
  if (!canReleaseExpiredTrialSession(session, userId, boundSessionId, session.id)) {
    return "retained";
  }
  const expired = await markExpiredClaim(userId, boundSessionId);
  return expired ? "expired" : "retained";
}

/**
 * A retry may return the exact same still-open Stripe Checkout Session.
 * Never create a second trial session for an existing claim.
 * Session must be fetched server-side by the claim's stored session ID.
 */
export function canReuseOpenTrialSession(
  session: Pick<Stripe.Checkout.Session,
    "id" | "status" | "mode" | "subscription" | "metadata" | "client_reference_id" | "url">,
  userId: string,
  boundSessionId: string
): boolean {
  return Boolean(userId) &&
    session.id === boundSessionId &&
    boundSessionId.startsWith("cs_") &&
    session.status === "open" &&
    session.mode === "subscription" &&
    session.subscription == null &&
    session.client_reference_id === userId &&
    session.metadata?.user_id === userId &&
    session.metadata?.stripe_trial_reserved === "true" &&
    typeof session.url === "string" &&
    session.url.startsWith("https://checkout.stripe.com/");
}
