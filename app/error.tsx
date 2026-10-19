"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("HoopCheck route error:", error);
  }, [error]);

  return (
    <main role="alert" style={{ maxWidth: 720, margin: "0 auto", padding: "96px 24px", textAlign: "center" }}>
      <p className="eyebrow">HOOPCHECK / ERROR</p>
      <h1>That play didn’t go as planned.</h1>
      <p className="muted">Something went wrong loading this page. You can try again or return to HoopCheck.</p>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12, marginTop: 24 }}>
        <button type="button" className="btn" onClick={() => reset()}>Try again</button>
        <Link href="/" className="btn">Back to home</Link>
      </div>
      {error.digest ? <p className="muted" style={{ marginTop: 24 }}>Reference: {error.digest}</p> : null}
    </main>
  );
}
