"use client";

import { ChangeEvent, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import TeamLogo from "../../../components/TeamLogo";
import TeamLeaguePicker from "../../../components/TeamLeaguePicker";

type Team = { id: string; tableName: "teams" | "womens_teams"; name: string; country: string | null; logo_url: string | null; logo_bg?: "transparent" | "light" | "dark" | null; basketball_type?:"mens"|"womens"|null };
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
  const [queueSearch, setQueueSearch] = useState("");
  const [queueGender, setQueueGender] = useState<"all" | "mens" | "womens">("all");
  const [queueCoverage, setQueueCoverage] = useState<"missing" | "all" | "complete">("missing");
  const [queuePage, setQueuePage] = useState(0);
  const [rightsReviewed, setRightsReviewed] = useState(false);

  // Read the complete directory. The previous 2,000-row limit excluded hundreds
  // of clubs from the admin logo queue, even though all teams are public.
  async function loadTeams() {
    const { data: access, error: accessError } = await supabase.rpc("is_current_user_admin_or_moderator");
    if (accessError || !access) {
      setMessage("Admin or moderator access is required.");
      setLoading(false);
      return;
    }
    async function allRows(table: "teams" | "womens_teams") {
      const rows: Team[] = [];
      for (let offset = 0; offset < 10000; offset += 500) {
        // Literal select strings preserve Supabase's typed PostgREST parser.
        // Women's mirror rows are presented via womens_teams, not twice.
        const response = table === "teams"
          ? await supabase.from("teams")
              .select("id,name,country,logo_url,logo_bg,basketball_type,source")
              .or("source.is.null,source.neq.womens_teams_mirror")
              .order("id").range(offset, offset + 499)
          : await supabase.from("womens_teams")
              .select("id,name,country,logo_url,logo_bg")
              .order("id").range(offset, offset + 499);
        if (response.error) throw response.error;
        const batch = (response.data || []).map((team) => ({
          ...team, tableName: table,
        })) as Team[];
        rows.push(...batch);
        if (batch.length < 500) break;
      }
      return rows;
    }
    try {
      const [primary, womens] = await Promise.all([allRows("teams"), allRows("womens_teams")]);
      setTeams([...primary, ...womens]);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load the complete team directory.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadTeams(); }, []);

  function pickerGender(teamKey:string):"mens"|"womens"|null {
    if(!teamKey)return null;
    const [tableName,id]=teamKey.split(":");
    if(tableName==="womens_teams")return "womens";
    return teams.find(team=>team.id===id&&team.tableName===tableName)?.basketball_type||null;
  }

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
    if (!rightsReviewed) { setMessage("Review the logo identity and your right to display it before publishing."); return; }
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

  async function revertToFallback() {
    if (!selectedTeam) return;
    const [tableName, id] = selectedTeam.split(":") as ["teams" | "womens_teams", string];
    const team = teams.find((item) => item.id === id && item.tableName === tableName);
    if (!team?.logo_url) { setMessage("This team is already using its fallback."); return; }
    if (!window.confirm(`Remove the approved logo for ${team.name} and restore its designed fallback?`)) return;
    setBusy(true); setMessage("");
    try {
      const { error } = await supabase.from(tableName).update({ logo_url: null, logo_bg: "transparent" }).eq("id", id);
      if (error) throw error;
      setTeams((items) => items.map((item) => item.id === id && item.tableName === tableName ? { ...item, logo_url: null, logo_bg: "transparent" } : item));
      setMessage("Logo reverted to the designed fallback. Stored file retained for recovery.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not revert logo."); }
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
    if (!rightsReviewed) { setMessage("Review this crest identity and usage rights before publishing."); return; }
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

  const matchingQueue = teams.filter(team => {
    const gender = team.tableName === "womens_teams" ? "womens" : team.basketball_type || "mens";
    if (queueGender !== "all" && gender !== queueGender) return false;
    const hasLogo = Boolean(team.logo_url?.trim());
    if (queueCoverage === "missing" && hasLogo) return false;
    if (queueCoverage === "complete" && !hasLogo) return false;
    const term = queueSearch.trim().toLocaleLowerCase();
    return !term || [team.name, team.country || "", gender].some(value => value.toLocaleLowerCase().includes(term));
  }).sort((a,b) => (a.country || "").localeCompare(b.country || "") || a.name.localeCompare(b.name));
  const queuePageSize = 40;
  const queuePages = Math.max(1, Math.ceil(matchingQueue.length / queuePageSize));
  const pageIndex = Math.min(queuePage, queuePages - 1);
  const visibleQueue = matchingQueue.slice(pageIndex * queuePageSize, (pageIndex + 1) * queuePageSize);
  const selectFromQueue = (team: Team) => {
    setSelectedTeam(team.tableName + ":" + team.id);
    document.getElementById("hc-logo-target")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return <main className="admin-team-logo-studio" style={{ minHeight: "100vh", background: "#0A0A0A", color: "#F7F7F5", padding: "28px 16px 70px" }}>
    <div style={{ maxWidth: 1050, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div><p style={{ color: "#FF5A1F", fontWeight: 900, letterSpacing: ".16em", fontSize: 11 }}>HOOPCHECK ADMIN</p><h1 style={{ fontSize: "clamp(2rem,5vw,3rem)", margin: "6px 0" }}>Team Logo Studio</h1><p style={{ color: "#aaa" }}>Upload authentic team crests or review source-page candidates. Missing crests remain clearly labeled placeholders. Fetched candidates are never published without approval.</p></div>
        <Link href="/admin/directory" style={{ color: "#F7F7F5", border: "1px solid #555", borderRadius: 9, padding: "10px 14px" }}>← Admin directory</Link>
      </div>
      {!loading && teams.length > 0 && (
        <section aria-label="Team logo coverage" style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 18 }}>
          <span style={{ border: "1px solid #444", borderRadius: 10, padding: "12px 16px" }}><strong>{teams.filter(team => Boolean(team.logo_url?.trim())).length}</strong> of <strong>{teams.length}</strong> clubs with logos</span>
          <span style={{ border: "1px solid #444", borderRadius: 10, padding: "12px 16px" }}><strong>{teams.filter(team => !team.logo_url?.trim()).length}</strong> still need an approved logo</span>
          <span style={{ border: "1px solid #444", borderRadius: 10, padding: "12px 16px" }}>Includes men's, standalone women's and mirrored women's club records</span>
        </section>
      )}
      {!loading && teams.length > 0 && <section aria-label="Missing team logo queue" style={{ borderTop: "1px solid #444", paddingTop: 16, marginTop: 18 }}>
        <h2 style={{ fontSize: 19, margin: "0 0 8px" }}>Logo review queue · {matchingQueue.length} clubs</h2>
        <p style={{ color: "#aaa", fontSize: 13, marginBottom: 12 }}>Filter all men’s and women’s clubs, including mirror-safe women’s profiles. Select a club to review its real crest below.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <input type="search" value={queueSearch} onChange={e => { setQueueSearch(e.target.value); setQueuePage(0); }} placeholder="Club or country" aria-label="Search logo queue" style={{ ...inputStyle, maxWidth: 270, padding: 9 }} />
          <select aria-label="Filter logo queue by gender" value={queueGender} onChange={e => { setQueueGender(e.target.value as typeof queueGender); setQueuePage(0); }} style={{ ...inputStyle, width: "auto", padding: 9 }}><option value="all">Men + Women</option><option value="mens">Men</option><option value="womens">Women</option></select>
          <select aria-label="Filter logo queue by coverage" value={queueCoverage} onChange={e => { setQueueCoverage(e.target.value as typeof queueCoverage); setQueuePage(0); }} style={{ ...inputStyle, width: "auto", padding: 9 }}><option value="missing">Missing crests</option><option value="all">All clubs</option><option value="complete">With logos</option></select>
        </div>
        <div style={{ display: "grid", gap: 3 }}>
          {visibleQueue.map(team => <div key={team.tableName + team.id} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, padding: "5px 1px", borderBottom: "1px solid #272727" }}>
            <TeamLogo name={team.name} logoUrl={team.logo_url} logoBg={team.logo_bg} size={34} />
            <div style={{ flex: 1, minWidth: 0 }}><strong style={{ fontSize: 13, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team.name}</strong><span style={{ color: "#aaa", fontSize: 11 }}>{team.country || "Country unlisted"} · {team.tableName === "womens_teams" || team.basketball_type === "womens" ? "Women" : "Men"} · {team.logo_url?.trim() ? "Image ready" : "Needs approved crest"}</span></div>
            <button type="button" onClick={() => selectFromQueue(team)} style={{ flexShrink: 0, border: "1px solid #666", borderRadius: 999, padding: "7px 12px", background: "transparent", color: "#fff", fontSize: 12 }}>{selectedTeam === team.tableName + ":" + team.id ? "Selected" : "Choose"}</button>
          </div>)}
          {visibleQueue.length === 0 && <p role="status" style={{ color: "#aaa" }}>No clubs match these filters.</p>}
        </div>
        {queuePages > 1 && <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
          <button type="button" disabled={pageIndex === 0} onClick={() => setQueuePage(Math.max(0, pageIndex - 1))} style={{ padding: "7px 12px" }}>Previous</button>
          <span style={{ fontSize: 12 }}>{pageIndex + 1} / {queuePages}</span>
          <button type="button" disabled={pageIndex + 1 >= queuePages} onClick={() => setQueuePage(pageIndex + 1)} style={{ padding: "7px 12px" }}>Next</button>
        </div>}
      </section>}
      {message && <p role="status" style={{ border: "1px solid #444", borderRadius: 9, padding: 12, background: "#151515" }}>{message}</p>}
      {loading ? <p>Checking access and loading teams…</p> : <>
        <section id="hc-logo-target" style={{ border: "1px solid #333", background: "#111", borderRadius: 14, padding: 18, marginTop: 22 }}>
          <h2>1. Choose a team</h2>
          <TeamLeaguePicker mode="team" directorySource="both" label="Team" value={selectedTeam} basketballType={pickerGender(selectedTeam)} onChange={setSelectedTeam} placeholder="Search teams by name, city or country" />
          {selectedTeam && <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12 }}><TeamLogo name={teams.find((team) => team.tableName + ":" + team.id === selectedTeam)?.name || "Team"} logoUrl={teams.find((team) => team.tableName + ":" + team.id === selectedTeam)?.logo_url} logoBg={teams.find((team) => team.tableName + ":" + team.id === selectedTeam)?.logo_bg} size={64}/><span>{teams.find((team) => team.tableName + ":" + team.id === selectedTeam)?.logo_url ? "Current approved logo" : "Using designed fallback"}</span></div>}
        </section>
        <section style={{ border: "1px solid #333", background: "#111", borderRadius: 14, padding: 18, marginTop: 16 }}>
          <h2>2. Upload an approved logo</h2>
          {selectedTeam && teams.find((team) => team.tableName + ":" + team.id === selectedTeam)?.logo_url && <button type="button" disabled={busy} onClick={() => void revertToFallback()} style={{ marginBottom: 12, border: "1px solid #F5B800", borderRadius: 999, background: "transparent", color: "#F7F7F5", padding: "9px 14px", fontWeight: 800 }}>Revert to designed fallback</button>}
          <p style={{ color: "#aaa" }}>PNG, SVG, JPG, or WebP. Maximum 5 MB. The image is copied into the HoopCheck team-logos bucket.</p>
          <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "9px 0", fontSize: 13 }}><input type="checkbox" checked={rightsReviewed} onChange={e => setRightsReviewed(e.target.checked)} /> I verified this club’s identity and our right to display the uploaded crest.</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            <label style={{ display: "grid", gap: 7 }}>Logo file<input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" onChange={(event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] || null)}/></label>
            <label style={{ display: "grid", gap: 7 }}>Logo tile background<select value={bg} onChange={(event) => setBg(event.target.value as typeof bg)} style={inputStyle}><option value="transparent">Transparent</option><option value="light">Light tile</option><option value="dark">Dark tile</option></select></label>
          </div>
          <button disabled={busy || !rightsReviewed} onClick={() => void uploadManual()} style={{ marginTop: 14, border: 0, borderRadius: 999, background: "var(--hc-button-primary-bg)", color: "var(--hc-button-primary-fg)", padding: "11px 18px", fontWeight: 900 }}>{busy ? "Working…" : "Upload and publish logo"}</button>
        </section>
        <section style={{ border: "1px solid #333", background: "#111", borderRadius: 14, padding: 18, marginTop: 16 }}>
          <h2>3. Fetch candidates from official source pages</h2>
          <p style={{ color: "#aaa" }}>Paste source-page URLs, one per line. HoopCheck extracts Open Graph images or Apple touch icons and shows a preview for manual approval. It never auto-publishes candidates.</p>
          <label style={{ display: "grid", gap: 7 }}>Source page URLs<textarea rows={4} value={urls} onChange={(event) => setUrls(event.target.value)} placeholder="https://official-club.example/" style={{ ...inputStyle, resize: "vertical" }}/></label>
          <button disabled={busy} onClick={() => void fetchCandidates()} style={{ marginTop: 12, border: "1px solid #555", borderRadius: 999, background: "#222", color: "#fff", padding: "10px 16px", fontWeight: 800 }}>{busy ? "Fetching…" : "Fetch candidate previews"}</button>
          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            {candidates.map((candidate, index) => <article key={candidate.sourceUrl + index} style={{ border: "1px solid #444", borderRadius: 12, padding: 14, display: "grid", gridTemplateColumns: "100px minmax(0,1fr)", gap: 14, alignItems: "center" }}>
              <div style={{ background: candidate.bg === "light" ? "#F7F7F5" : candidate.bg === "dark" ? "#0A0A0A" : "#222", borderRadius: 10, padding: 8 }}><img src={candidate.imageData} alt="Logo candidate preview" style={{ width: 84, height: 84, objectFit: "contain" }}/></div>
              <div style={{ minWidth: 0 }}><p style={{ overflowWrap: "anywhere", color: "#aaa", fontSize: 12 }}>{candidate.sourceUrl}</p><p style={{ overflowWrap: "anywhere", fontSize: 12 }}>Image: {candidate.imageUrl}</p><TeamLeaguePicker mode="team" directorySource="both" label="Assign team" value={candidate.teamId} basketballType={pickerGender(candidate.teamId)} onChange={value=>updateCandidate(index,"teamId",value)} placeholder="Search team" /><label style={{ display: "block", marginTop: 8 }}>Tile background<select value={candidate.bg} onChange={(event) => updateCandidate(index, "bg", event.target.value)} style={{ ...inputStyle, marginTop: 5 }}><option value="transparent">Transparent</option><option value="light">Light</option><option value="dark">Dark</option></select></label><button disabled={busy || !rightsReviewed || candidate.approved} onClick={() => void approveCandidate(index)} style={{ marginTop: 10, border: 0, borderRadius: 999, background: candidate.approved ? "#333" : "#FF5A1F", color: "#fff", padding: "9px 14px", fontWeight: 900 }}>{candidate.approved ? "Approved and published" : "Approve and publish"}</button></div>
            </article>)}
          </div>
        </section>
      </>}
    </div>
  </main>;
}
