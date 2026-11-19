"use client";
import { useEffect } from "react";
import { useMfaSession } from "../../../components/MfaSession";
export default function VerifyPage() {
  const security = useMfaSession();
  useEffect(() => {
    if (security.phase !== "ready" || !security.owner) return;
    const target = new URLSearchParams(window.location.search).get("returnTo") || "/dashboard";
    const valid = /^\/(?!\/)/.test(target) && !/[\\\u0000-\u001f]/.test(target) && !/^\/(?:auth|login|signup)(?:[/?#]|$)/i.test(target);
    window.location.replace(valid ? target : "/dashboard");
  }, [security.phase, security.owner]);
  return <section className="hc-security-page"><h1>Finish signing in</h1><p>{security.owner ? "Verifying your account…" : "Sign in to continue."}</p>{!security.owner ? <a href="/login">Return to sign-in</a> : null}</section>;
}
