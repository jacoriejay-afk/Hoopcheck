"use client";
import { useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { evidenceDownloadName } from "../lib/security/evidence-download";

type Bucket = "player-verification-documents" | "profile-claim-proofs";
export default function EvidenceDownload({ bucket, path }: { bucket: Bucket; path: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const active = useRef(false);
  async function download() {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setMessage("");
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Sign in again to access evidence.");
      const { data: role, error: roleError } = await supabase.rpc("is_current_user_admin_or_moderator");
      if (roleError || !role) throw new Error("Staff access is required.");
      const name = evidenceDownloadName(path);
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60, { download: name });
      if (error || !data?.signedUrl) throw new Error("Evidence is unavailable.");
      const url = new URL(data.signedUrl);
      const origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").origin;
      if (url.protocol !== "https:" || url.origin !== origin || url.username || url.password || !url.searchParams.has("download")) throw new Error("Unsafe evidence URL.");
      const { data: { user: current }, error: currentError } = await supabase.auth.getUser();
      if (currentError || current?.id !== user.id) throw new Error("Your account changed. Sign in again.");
      const link = document.createElement("a");
      link.href = url.href;
      link.download = name;
      link.rel = "noopener noreferrer";
      link.referrerPolicy = "no-referrer";
      document.body.appendChild(link);
      try { link.click(); } finally { link.remove(); }
      setMessage("Download requested. Treat the file as untrusted evidence.");
    } catch {
      setMessage("Unable to download evidence. Check your staff access and try again.");
    } finally {
      active.current = false;
      setBusy(false);
    }
  }
  return <span><button className="btn" type="button" disabled={busy} onClick={() => void download()}>{busy ? "Preparing…" : "Download private evidence"}</button>{message && <span role="status"> {message}</span>}</span>;
}
