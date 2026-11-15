export function getStripeKeyMode(key: string | undefined): "live" | "test" | null {
  if (key?.startsWith("sk_live_") || key?.startsWith("rk_live_")) return "live";
  if (key?.startsWith("sk_test_") || key?.startsWith("rk_test_")) return "test";
  return null;
}

export function stripeMatchesDeployment(key: string | undefined): boolean {
  if (process.env.VERCEL_ENV === "production") return getStripeKeyMode(key) === "live";

  const testUrl = process.env.HOOPCHECK_STRIPE_TEST_SUPABASE_URL;
  if (getStripeKeyMode(key) !== "test" || !testUrl || testUrl !== process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return false;
  }

  try {
    const hostname = new URL(testUrl).hostname.replace(/\.$/, "");
    return hostname !== "ucbdceaieyenljcwlhnj.supabase.co";
  } catch {
    return false;
  }
}
