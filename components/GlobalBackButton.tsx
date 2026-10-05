"use client";

import { useRouter } from "next/navigation";

export default function GlobalBackButton() {
  const router = useRouter();
  return (
    <button type="button" className="global-back-button" onClick={() => router.back()} aria-label="Go back">
      ← Back
    </button>
  );
}
