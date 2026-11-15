export function getStripeKeyMode(key: string | undefined): "live" | "test" | null {
  if (key?.startsWith("sk_live_") || key?.startsWith("rk_live_")) return "live";
  if (key?.startsWith("sk_test_") || key?.startsWith("rk_test_")) return "test";
  return null;
}
