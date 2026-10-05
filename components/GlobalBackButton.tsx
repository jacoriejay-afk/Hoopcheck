"use client";

import { useRouter } from "next/navigation";

export default function GlobalBackButton() {
  const router = useRouter();
  return (
    <button type="button" className="global-back-button" onClick={() => { if (window.history.length > 1) router.back(); else router.push("/dashboard"); }} aria-label="Go back">
      ← Back
    </button>
  );
}
