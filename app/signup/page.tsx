import SignupForm from "./SignupForm";
import { getActiveReferral } from "../../lib/ambassador/server";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ referral?: string }>;
}) {
  const [referral, params] = await Promise.all([getActiveReferral(), searchParams]);
  return <SignupForm referralToken={referral ?? undefined} referralUnavailable={params.referral === "unavailable"} />;
}
