/**
 * A deliberate, fail-closed public-trial activation boundary.
 *
 * This helper does not grant trials. The authenticated Checkout handler still
 * checks verified account ownership, billing role, monthly interval, existing
 * entitlements, Stripe history and one-time atomic reservation before creating
 * a hosted trial session. Keep the production flag OFF until signed E2E tests.
 */
export type ProductionTrialGateInput = {
  vercelEnvironment?: string;
  featureEnabled?: string;
  siteUrl?: string;
  supabaseUrl?: string;
  stripeCheckoutMode?: string;
  checkoutEnabled: boolean;
  stripeKeyMatches: boolean;
};

export function canEnableProductionSevenDayTrial(input: ProductionTrialGateInput): boolean {
  return input.vercelEnvironment === "production" &&
    input.featureEnabled === "true" &&
    input.siteUrl === "https://hoopcheck.online" &&
    input.supabaseUrl === "https://ucbdceaieyenljcwlhnj.supabase.co" &&
    input.stripeCheckoutMode === "live" &&
    input.checkoutEnabled === true &&
    input.stripeKeyMatches === true;
}
