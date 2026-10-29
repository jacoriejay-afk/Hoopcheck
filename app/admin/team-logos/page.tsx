"use client";

import { ChangeEvent, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import TeamLogo from "../../../components/TeamLogo";

type Team = { id: string; tableName: "teams" | "womens_teams"; name: string; country: string | null; logo_url: string | null; logo_bg?: "transparent" | "light" | "dark" | null };
type Candidate = { sourceUrl: string; teamId: string; imageData: string; mimeType: string; imageUrl: string; bg: "transparent" | "light" | "dark"; approved: boolean };

const inputStyle: React.CSSProperties = { width: "100%", padding: 12, borderRadius: 8, border: "1px solid #444", background: "#111", color: "#fff" };

export default function AdminTeamLogosPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [bg, setBg] = useState<"transparent" | "light" | "dark">("transparent");
  const [urls, setUrls] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function loadTeams() {
    const { data: access, error: accessError } = await supabase.rpc("is_current_user_admin_or_moderator");
    if (accessError || !access) {
      setMessage("Admin or moderator access is required.");
      setLoading(false);
      return;
    }
    const [{ data: mens, error: mensError }, { data: womens, error: womensError }] = await Promise.all([
      supabase.from("teams").select("id,name,country,logo_url,logo_bg").order("name").limit(2000),
      supabase.from("womens_teams").select("id,name,country,logo_url,logo_bg").order("name").limit(1000),
    ]);
    const error = mensError || womensError;
    if (error) setMessage(error.message);
    else setTeams([
      ...((mens || []).map((team) => ({ ...team, tableName: "teams" as const }))),
      ...((womens || []).map((team) => ({ ...team, tableName: "womens_teams" as const }))),
    ] as Team[]);
    setLoading(false);
  }

  useEffect(() => { void loadTeams(); }, []);

  async function uploadApproved(teamId: string, imageData: string, mimeType: string, background: "transparent" | "light" | "dark") {
    const [tableName, id] = teamId.split(":") as ["teams" | "womens_teams", string];
    const team = teams.find((item) => item.id === id && item.tableName === tableName);
    if (!team) throw new Error("Choose a team before approving this logo.");
    const ext = mimeType === "image/svg+xml" ? "svg" : mimeType === "image/webp" ? "webp" : mimeType === "image/png" ? "png" : "jpg";
    const base64 = imageData.split(",")[1] || "";
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const blob = new Blob([bytes], { type: mimeType });
    if (blob.size < 1024 || blob.size > 5 * 1024 * 1024) throw new Error("Logo must be between 1 KB and 5 MB.");
    const path = `${tableName}/${id}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage.from("team-logos").upload(path, blob, { upsert: true, contentType: mimeType, cacheControl: "3600" });
    if (uploadError) throw uploadError;
    const { data: publicData } = supabase.storage.from("team-logos").getPublicUrl(path);
    const { error: updateError } = await supabase.from(tableName).update({ logo_url: publicData.publicUrl, logo_bg: background }).eq("id", id);
    if (updateError) throw updateError;
    setTeams((items) => items.map((item) => item.id === id && item.tableName === tableName ? { ...item, logo_url: publicData.publicUrl, logo_bg: background } : item));
  }

  async function uploadManual() {
    if (!selectedTeam || !file) { setMessage("Select a team and choose an image."); return; }
    if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)) { setMessage("Use PNG, SVG, JPG, or WebP."); return; }
    setBusy(true); setMessage("");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read image."));
        reader.onerror = () => reject(new Error("Could not read image."));
        reader.readAsDataURL(file);
      });
      await uploadApproved(selectedTeam, dataUrl, file.type, bg);
      setMessage("Logo saved to HoopCheck Storage and the team profile.");
      setFile(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Logo upload failed."); }
    finally { setBusy(false); }
  }

  async function fetchCandidates() {
    const sourceUrls = urls.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    if (!selectedTeam) { setMessage("Select a team first; each candidate must be tied to a team."); return; }
    if (!sourceUrls.length) { setMessage("Paste one or more official team page URLs, one per line."); return; }
    setBusy(true); setMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const result = await Promise.all(sourceUrls.map(async (sourceUrl) => {
        const response = await fetch("/api/admin/team-logo-candidate", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
          body: JSON.stringify({ sourceUrl }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || `Could not fetch candidate from ${sourceUrl}`);
        return { sourceUrl, teamId: selectedTeam, imageData: payload.imageData, mimeType: payload.mimeType, imageUrl: payload.imageUrl, bg: "transparent" as const, approved: false };
      }));
      setCandidates((previous) => [...previous, ...result]);
      setMessage(`${result.length} candidate image(s) ready for preview. Nothing has been published.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Candidate fetch failed."); }
    finally { setBusy(false); }
  }

  async function approveCandidate(index: number) {
    const candidate = candidates[index];
    if (!candidate) return;
    setBusy(true); setMessage("");
    try {
      await uploadApproved(candidate.teamId, candidate.imageData, candidate.mimeType, candidate.bg);
      setCandidates((items) => items.map((item, i) => i === index ? { ...item, approved: true } : item));
      setMessage("Approved candidate copied into HoopCheck Storage and published.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save approved candidate."); }
    finally { setBusy(false); }
  }

  function updateCandidate(index: number, key: "teamId" | "bg", value: string) {
    setCandidates((items) => items.map((item, i) => i === index ? { ...item, [key]: value } : item));
  }

  return <main style={{ minHeight: "100vh", background: "#0A0A0A", color: "#F7F7F5", padding: "28px 16px 70px" }}>
    <div style={{ maxWidth: 1050, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div><p style={{ color: "#FF5A1F", fontWeight: 900, letterSpacing: ".16em", fontSize: 11 }}>HOOPCHECK ADMIN</p><h1 style={{ fontSize: "clamp(2rem,5vw,3rem)", margin: "6px 0" }}>Team Logo Studio</h1><p style={{ color: "#aaa" }}>Upload logos or review source-page candidates. Fetched candidates are never published without approval.</p></div>
        <Link href="/admin/directory" style={{ color: "#F7F7F5", border: "1px solid #555", borderRadius: 9, padding: "10px 14px" }}>← Admin directory</Link>
      </div>
      {message && <p role="status" style={{ border: "1px solid #444", borderRadius: 9, padding: 12, background: "#151515" }}>{message}</p>}
      {loading ? <p>Checking access and loading teams…</p> : <>
        <section style={{ border: "1px solid #333", background: "#111", borderRadius: 14, padding: 18, marginTop: 22 }}>
          <h2>1. Choose a team</h2>
          <label style={{ display: "grid", gap: 7 }}>Team<select value={selectedTeam} onChange={(event) => setSelectedTeam(event.target.value)} style={inputStyle}><option value="">Select team…</option>{teams.map((team) => <option key={team.tableName + ":" + team.id} value={team.tableName + ":" + team.id}>{team.tableName === "womens_teams" ? "Women · " : "Team · "}{team.name}{team.country ? ` — ${team.country}` : ""}</option>)}</select></label>
          {selectedTeam && <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12 }}><TeamLogo name={teams.find((team) => team.tableName + ":" + team.id === selectedTeam)?.name || "Team"} logoUrl={teams.find((team) => team.tableName + ":" + team.id === selectedTeam)?.logo_url} logoBg={teams.find((team) => team.tableName + ":" + team.id === selectedTeam)?.logo_bg} size={64}/><span>{teams.find((team) => team.tableName + ":" + team.id === selectedTeam)?.logo_url ? "Current approved logo" : "Using designed fallback"}</span></div>}
        </section>
        <section style={{ border: "1px solid #333", background: "#111", borderRadius: 14, padding: 18, marginTop: 16 }}>
          <h2>2. Upload an approved logo</h2>
          <p style={{ color: "#aaa" }}>PNG, SVG, JPG, or WebP. Maximum 5 MB. The image is copied into the HoopCheck team-logos bucket.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            <label style={{ display: "grid", gap: 7 }}>Logo file<input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" onChange={(event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] || null)}/></label>
            <label style={{ display: "grid", gap: 7 }}>Logo tile background<select value={bg} onChange={(event) => setBg(event.target.value as typeof bg)} style={inputStyle}><option value="transparent">Transparent</option><option value="light">Light tile</option><option value="dark">Dark tile</option></select></label>
          </div>
          <button disabled={busy} onClick={() => void uploadManual()} style={{ marginTop: 14, border: 0, borderRadius: 999, background: "#FF5A1F", color: "#fff", padding: "11px 18px", fontWeight: 900 }}>{busy ? "Working…" : "Upload and publish logo"}</button>
        </section>
        <section style={{ border: "1px solid #333", background: "#111", borderRadius: 14, padding: 18, marginTop: 16 }}>
          <h2>3. Fetch candidates from official source pages</h2>
          <p style={{ color: "#aaa" }}>Paste source-page URLs, one per line. HoopCheck extracts Open Graph images or Apple touch icons and shows a preview for manual approval. It never auto-publishes candidates.</p>
          <label style={{ display: "grid", gap: 7 }}>Source page URLs<textarea rows={4} value={urls} onChange={(event) => setUrls(event.target.value)} placeholder="https://official-club.example/" style={{ ...inputStyle, resize: "vertical" }}/></label>
          <button disabled={busy} onClick={() => void fetchCandidates()} style={{ marginTop: 12, border: "1px solid #555", borderRadius: 999, background: "#222", color: "#fff", padding: "10px 16px", fontWeight: 800 }}>{busy ? "Fetching…" : "Fetch candidate previews"}</button>
          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            {candidates.map((candidate, index) => <article key={candidate.sourceUrl + index} style={{ border: "1px solid #444", borderRadius: 12, padding: 14, display: "grid", gridTemplateColumns: "100px minmax(0,1fr)", gap: 14, alignItems: "center" }}>
              <div style={{ background: candidate.bg === "light" ? "#F7F7F5" : candidate.bg === "dark" ? "#0A0A0A" : "#222", borderRadius: 10, padding: 8 }}><img src={candidate.imageData} alt="Logo candidate preview" style={{ width: 84, height: 84, objectFit: "contain" }}/></div>
              <div style={{ minWidth: 0 }}><p style={{ overflowWrap: "anywhere", color: "#aaa", fontSize: 12 }}>{candidate.sourceUrl}</p><p style={{ overflowWrap: "anywhere", fontSize: 12 }}>Image: {candidate.imageUrl}</p><label>Assign team<select value={candidate.teamId} onChange={(event) => updateCandidate(index, "teamId", event.target.value)} style={{ ...inputStyle, marginTop: 5 }}>{teams.map((team) => <option key={team.tableName + ":" + team.id} value={team.tableName + ":" + team.id}>{team.tableName === "womens_teams" ? "Women · " : "Team · "}{team.name}</option>)}</select></label><label style={{ display: "block", marginTop: 8 }}>Tile background<select value={candidate.bg} onChange={(event) => updateCandidate(index, "bg", event.target.value)} style={{ ...inputStyle, marginTop: 5 }}><option value="transparent">Transparent</option><option value="light">Light</option><option value="dark">Dark</option></select></label><button disabled={busy || candidate.approved} onClick={() => void approveCandidate(index)} style={{ marginTop: 10, border: 0, borderRadius: 999, background: candidate.approved ? "#333" : "#FF5A1F", color: "#fff", padding: "9px 14px", fontWeight: 900 }}>{candidate.approved ? "Approved and published" : "Approve and publish"}</button></div>
            </article>)}
          </div>
        </section>
      </>}
    </div>
  </main>;
}
