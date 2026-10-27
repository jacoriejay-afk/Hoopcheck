"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
export default function BlockUserAction({ userId, label = "Block user", onChange }: { userId: string; label?: string; onChange?: (blocked: boolean) => void }) {
  const [blocked, setBlocked] = useState(false); const [isSelf, setIsSelf] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  useEffect(() => { let active = true; void (async () => { const { data: { user } } = await supabase.auth.getUser(); if (active && user?.id === userId) { setIsSelf(true); return; } const { data } = await supabase.from("user_blocks").select("id").eq("blocked_id", userId).maybeSingle(); if (active) setBlocked(!!data); })(); return () => { active = false; }; }, [userId]);
  async function toggle() {
    setBusy(true); setMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession(); if (!session?.access_token) throw new Error("Sign in to manage blocked users.");
      const action = blocked ? "unblock" : "block";
      const response = await fetch("/api/blocks", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ userId, action }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Could not update block.");
      setBlocked(action === "block"); onChange?.(action === "block"); setMessage(action === "block" ? "User blocked." : "User unblocked.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update block."); }
    finally { setBusy(false); }
  }
  if (isSelf) return null;
  return <span className="hc-trust-action"><button type="button" className="btn dark" disabled={busy} onClick={() => { if (blocked || window.confirm("Block this user? Their content will be hidden where block filters are applied.")) void toggle(); }}>{busy ? "Saving…" : blocked ? "Unblock" : label}</button>{message && <small role="status">{message}</small>}</span>;
}
