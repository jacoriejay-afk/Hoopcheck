"use client";

import { useState } from "react";
import { shareHoopCheckEntity } from "../lib/native-links";

type Props = { path: string; title: string; text?: string };

export default function ShareEntityButton({ path, title, text }: Props) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function share() {
    setBusy(true);
    setMessage("");
    const result = await shareHoopCheckEntity({
      url: path,
      title,
      text: text || `View ${title} on HoopCheck`,
    });
    if (result === "shared") setMessage("Share sheet opened.");
    else if (result === "copied") setMessage("Link copied.");
    else if (result === "unsupported") setMessage("Sharing is not available on this device.");
    else setMessage("Sharing was cancelled or unavailable.");
    setBusy(false);
  }

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <button type="button" className="btn dark" onClick={share} disabled={busy}>
        {busy ? "Sharing…" : "Share"}
      </button>
      {message && <span className="muted" role="status" aria-live="polite" style={{ fontSize: 12 }}>{message}</span>}
    </span>
  );
}
