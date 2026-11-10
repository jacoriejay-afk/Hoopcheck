import { redirect } from "next/navigation";
import { GOOGLE_SIGNUP_ROLE } from "../../../lib/google-auth";
import { createAuthClient } from "../../../lib/server/supabase-auth";
import SignupForm from "../SignupForm";

export default async function GoogleSignupPage() {
  const supabase = await createAuthClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?google_error=failed");
  if (data.claims.role !== GOOGLE_SIGNUP_ROLE) redirect("/dashboard");

  return <SignupForm googleEmail={data.claims.email ?? ""} />;
}
