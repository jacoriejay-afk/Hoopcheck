export type TrialEligibilityInput = {
  rolloutEnabled: boolean;
  interval: string;
  hasPromoCode: boolean;
  hasExistingSubscription: boolean;
  hasVerifiedEmail: boolean;
  customerLookupComplete: boolean;
  hasPriorStripeSubscription: boolean;
};

export function isEligibleForSevenDayTrial(input: TrialEligibilityInput): boolean {
  return input.rolloutEnabled &&
    input.interval === "month" &&
    !input.hasPromoCode &&
    !input.hasExistingSubscription &&
    input.hasVerifiedEmail &&
    input.customerLookupComplete &&
    !input.hasPriorStripeSubscription;
}
