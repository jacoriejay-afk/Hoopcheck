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
    input.accountType === "player" &&
    !input.hasPromoCode &&
    !input.hasExistingSubscription &&
    input.hasVerifiedEmail &&
    input.customerLookupComplete &&
    !input.hasPriorStripeSubscription;
}
