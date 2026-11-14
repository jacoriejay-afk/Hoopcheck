import SignupForm from "./SignupForm";
import { getActiveReferral } from "../../lib/ambassador/server";

export default async function SignupPage() {
  const referral = await getActiveReferral();
  return <SignupForm referralToken={referral ?? undefined} />;
}
