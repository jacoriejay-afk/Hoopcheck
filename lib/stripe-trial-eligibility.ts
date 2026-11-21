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
    // The trial is available to all verified HoopCheck account types.
    // The checkout route separately enforces account-specific plan rules.
    typeof input.accountType === "string" && input.accountType.trim().length > 0 &&
    !input.hasPromoCode &&
    !input.hasExistingSubscription &&
    input.hasVerifiedEmail &&
    input.customerLookupComplete &&
    !input.hasPriorStripeSubscription;
}
