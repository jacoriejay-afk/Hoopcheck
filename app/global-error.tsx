"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("HoopCheck global application error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0D0D0D", color: "#F8F9FA", fontFamily: "Arial, sans-serif" }}>
        <main role="alert" style={{ maxWidth: 720, margin: "0 auto", padding: "96px 24px", textAlign: "center" }}>
          <p style={{ color: "#FF5500", fontWeight: 800, letterSpacing: ".12em" }}>HOOPCHECK / ERROR</p>
          <h1>We hit an unexpected problem.</h1>
          <p style={{ color: "#D1D5DB", lineHeight: 1.6 }}>The page could not load. Try again, or return to HoopCheck and continue from there.</p>
          <button type="button" onClick={() => reset()} style={{ minHeight: 48, padding: "12px 20px", border: 0, borderRadius: 12, background: "#FF5500", color: "#111111", fontWeight: 800, cursor: "pointer" }}>Try again</button>
        </main>
      </body>
    </html>
  );
}
