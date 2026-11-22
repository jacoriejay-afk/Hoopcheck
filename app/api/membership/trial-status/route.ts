import { NextResponse } from "next/server";
import { stripeMatchesDeployment } from "../../../../lib/stripe-key-mode";
import { canEnableProductionSevenDayTrial } from "../../../../lib/stripe-trial-production-rollout";

export const dynamic = "force-dynamic";

/**
 * Public, read-only offer disclosure; never authorizes Checkout or exposes
 * credentials. The authenticated Checkout route independently rechecks this
 * exact production gate and every user's eligibility before issuing a trial.
 */
export function GET() {
  // Public trial is still disabled in Build 9 Checkout pending signed sandbox acceptance.
  // An unrelated environment flag must never claim an unavailable offer is live.
  const trialActivationApproved = false;
  const available = trialActivationApproved && canEnableProductionSevenDayTrial({
    vercelEnvironment: process.env.VERCEL_ENV,
    featureEnabled: process.env.HOOPCHECK_SEVEN_DAY_TRIAL_ENABLED,
    siteUrl: process.env.VERCEL_ENV === "production"
      ? "https://hoopcheck.online"
      : process.env.NEXT_PUBLIC_SITE_URL,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    stripeCheckoutMode: process.env.STRIPE_CHECKOUT_MODE,
    checkoutEnabled: process.env.STRIPE_CHECKOUT_ENABLED === "true",
    stripeKeyMatches: stripeMatchesDeployment(process.env.STRIPE_SECRET_KEY),
  });

  return NextResponse.json({ available }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
