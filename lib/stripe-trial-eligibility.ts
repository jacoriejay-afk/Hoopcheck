// The membership webhook can activate these current account types. Sharing
// this guard with Checkout avoids offering a trial to a role that cannot be
// activated after Stripe confirms the subscription.
export const SUBSCRIBABLE_HOOPCHECK_ACCOUNT_TYPES = [
  "player", "fan", "coach", "manager", "agent", "scout", "club_admin",
] as const;

export function isSupportedSubscriptionAccountType(value: unknown): value is (typeof SUBSCRIBABLE_HOOPCHECK_ACCOUNT_TYPES)[number] {
  return typeof value === "string" &&
    (SUBSCRIBABLE_HOOPCHECK_ACCOUNT_TYPES as readonly string[]).includes(value);
}

export type TrialEligibilityInput = {
  rolloutEnabled: boolean;
  interval: string;
  accountType: string;
  hasPromoCode: boolean;
  hasExistingSubscription: boolean;
  hasVerifiedEmail: boolean;
  customerLookupComplete: boolean;
  hasPriorStripeSubscription: boolean;
};

export function isEligibleForSevenDayTrial(input: TrialEligibilityInput): boolean {
  return input.rolloutEnabled &&
    input.interval === "month" &&
    // All currently supported subscription roles, with no Player-only gate.
    isSupportedSubscriptionAccountType(input.accountType) &&
    !input.hasPromoCode &&
    !input.hasExistingSubscription &&
    input.hasVerifiedEmail &&
    input.customerLookupComplete &&
    !input.hasPriorStripeSubscription;
}
