"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = { teamId: string; teamName: string; teamTable?: "teams" | "womens_teams"; onSaved?: (logoUrl: string, logoBg: "transparent" | "light" | "dark") => void };

export default function ClaimedTeamLogoEditor({ teamId, teamName, teamTable = "teams", onSaved }: Props) {
  const [allowed, setAllowed] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [bg, setBg] = useState<"transparent" | "light" | "dark">("transparent");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { if (active) setAllowed(false); return; }
      const { data, error } = await supabase.from("profile_claim_requests").select("id")
        .eq("requester_id", session.user.id).eq("entity_type", "team").eq("entity_id", teamId)
        .eq("status", "approved").limit(1);
      if (active) setAllowed(!error && Boolean(data?.length));
    })();
    return () => { active = false; };
  }, [teamId, teamTable]);

  async function save() {
    if (!file || busy) return;
    if (![ "image/png", "image/jpeg", "image/webp", "image/svg+xml" ].includes(file.type)) { setMessage("Choose a PNG, SVG, JPG, or WebP image."); return; }
    if (file.size < 1024 || file.size > 5 * 1024 * 1024) { setMessage("Logo must be between 1 KB and 5 MB."); return; }
    setBusy(true); setMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Please sign in again.");
      const ext = file.type === "image/svg+xml" ? "svg" : file.type === "image/webp" ? "webp" : file.type === "image/png" ? "png" : "jpg";
      const path = `${teamTable}/${teamId}/claimed-${session.user.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("team-logos").upload(path, file, { upsert: false, contentType: file.type, cacheControl: "3600" });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from("team-logos").getPublicUrl(path);
      const { error: updateError } = await supabase.rpc("set_claimed_team_logo", { p_team_id: teamId, p_logo_url: publicData.publicUrl, p_logo_bg: bg, p_team_table: teamTable });
      if (updateError) throw updateError;
      onSaved?.(publicData.publicUrl, bg);
      setFile(null);
      setMessage("Logo updated. It is now live on your club profile.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Logo update failed."); }
    finally { setBusy(false); }
  }

  if (!allowed) return null;
  return <section className="hc-claimed-logo-editor" aria-label={`Manage ${teamName} logo`}>
    <span className="hc-claimed-profile-chip">CLAIMED · COMPLETE PROFILE</span>
    <details><summary>Manage club logo</summary>
      <p>Upload an official club logo. Accepted formats: PNG, SVG, JPG, WebP · 1 KB–5 MB.</p>
      <label>Logo image<input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" onChange={event => setFile(event.target.files?.[0] || null)} /></label>
      <label>Logo tile background<select value={bg} onChange={event => setBg(event.target.value as typeof bg)}><option value="transparent">Transparent</option><option value="light">Light tile</option><option value="dark">Dark tile</option></select></label>
      <button type="button" disabled={busy || !file} onClick={() => void save()}>{busy ? "Saving…" : "Upload and publish logo"}</button>
      {message && <p role="status">{message}</p>}
    </details>
  </section>;
}
