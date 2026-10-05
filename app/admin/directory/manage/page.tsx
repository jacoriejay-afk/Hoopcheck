"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";

type Kind = "coaches" | "teams" | "leagues";

type Coach = { id: string; name: string; country: string | null; city: string | null; current_team_id: string | null; active: boolean };
type Team = { id: string; name: string; country: string | null; city: string | null; league_id: string | null; league_name: string | null; active: boolean };
type League = { id: string; name: string; country: string | null; level: string | null; season: string | null; active: boolean };

const EUROPE_COUNTRIES = ["Albania","Andorra","Armenia","Austria","Azerbaijan","Belarus","Belgium","Bosnia and Herzegovina","Bulgaria","Croatia","Cyprus","Czechia","Denmark","Estonia","Finland","France","Georgia","Germany","Greece","Hungary","Iceland","Ireland","Israel","Italy","Kosovo","Latvia","Lithuania","Luxembourg","Malta","Moldova","Montenegro","Netherlands","North Macedonia","Norway","Poland","Portugal","Romania","Russia","Serbia","Slovakia","Slovenia","Spain","Sweden","Switzerland","Türkiye","Ukraine","United Kingdom"];

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 12px", borderRadius: 8, border: "1px solid #303030",
  background: "#111", color: "#fff", boxSizing: "border-box",
};

export default function DirectoryManagerPage() {
  const [kind, setKind] = useState<Kind>("coaches");
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string,string | boolean>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: c }, { data: t }, { data: l }] = await Promise.all([
      supabase.from("coaches").select("id,name,country,city,current_team_id,active").order("name").limit(500),
      supabase.from("teams").select("id,name,country,city,league_id,league_name,active").order("name").limit(500),
      supabase.from("leagues").select("id,name,country,level,season,active").order("name").limit(500),
    ]);
    setCoaches(c || []);
    setTeams(t || []);
    setLeagues(l || []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function startNew() {
    setEditing("new");
    setForm(kind === "coaches"
      ? { name: "", country: "", city: "", current_team_id: "", active: true }
      : kind === "teams"
      ? { name: "", country: "", city: "", league_id: "", league_name: "", active: true }
      : { name: "", country: "", level: "", season: "2026-27", active: true });
    setMessage("");
  }

  function startEdit(item: Coach | Team | League) {
    setEditing(item.id);
    setForm(Object.fromEntries(Object.entries(item).map(([k,v]) => [k, v ?? ""])));
    setMessage("");
  }

  function cancel() {
    setEditing(null);
    setForm({});
    setMessage("");
  }

  async function save() {
    const name = String(form.name || "").trim();
    if (!name) { setMessage("Name is required."); return; }
    setSaving(true); setMessage("");

    const clean = (v: unknown) => {
      const s = String(v ?? "").trim();
      return s ? s : null;
    };

    let payload: Record<string, unknown>;
    if (kind === "coaches") {
      payload = { name, country: clean(form.country), city: clean(form.city), current_team_id: clean(form.current_team_id), active: Boolean(form.active) };
    } else if (kind === "teams") {
      const league = leagues.find((x) => x.id === form.league_id);
      payload = { name, country: clean(form.country), city: clean(form.city), league_id: clean(form.league_id), league_name: league?.name || clean(form.league_name), active: Boolean(form.active) };
    } else {
      payload = { name, country: clean(form.country), level: clean(form.level), season: clean(form.season), active: Boolean(form.active) };
    }

    const result = editing === "new"
      ? await supabase.from(kind).insert(payload)
      : await supabase.from(kind).update(payload).eq("id", editing);

    setSaving(false);
    if (result.error) { setMessage(result.error.message); return; }
    setMessage(editing === "new" ? "Record created." : "Record updated.");
    setEditing(null);
    setForm({});
    await load();
  }

  async function deleteRecord(id: string) {
    const typeLabel = kind.slice(0, -1);
    const item = (kind === "coaches" ? coaches : kind === "teams" ? teams : leagues).find((x) => x.id === id);
    if (!item) return;
    if (!confirm(`Permanently delete this ${typeLabel} "${item.name}"? This cannot be undone. Records with reviews or linked relationships are protected.`)) return;
    setMessage("");
    const { error } = await supabase.rpc("admin_delete_directory_entry", { p_type: typeLabel === "coach" ? "coach" : typeLabel === "team" ? "team" : "league", p_id: id });
    if (error) setMessage(error.message);
    else { setMessage("Record deleted."); await load(); }
  }

  async function archive(id: string) {
    if (!confirm("Archive this directory record? It will no longer appear as active.")) return;
    const { error } = await supabase.from(kind).update({ active: false }).eq("id", id);
    if (error) setMessage(error.message);
    else { setMessage("Record archived."); await load(); }
  }

  const items = (kind === "coaches" ? coaches : kind === "teams" ? teams : leagues).filter((item) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return [item.name, item.country, "city" in item ? item.city : "", "level" in item ? item.level : "", "league_name" in item ? item.league_name : ""]
      .some((v) => String(v || "").toLowerCase().includes(q));
  });

  return (
    <main style={{ minHeight: "100vh", background: "#050505", color: "#fff", padding: "35px 20px 80px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 15, flexWrap: "wrap", alignItems: "center", marginBottom: 25 }}>
          <div>
            <div style={{ color: "#ff6a00", fontSize: 11, fontWeight: 900, letterSpacing: ".15em" }}>HOOPCHECK ADMIN</div>
            <h1 style={{ fontSize: "clamp(2rem,5vw,3.5rem)", margin: "7px 0" }}>Directory Manager</h1>
            <p style={{ color: "#888", margin: 0 }}>Create, edit, search, and archive worldwide basketball records.</p>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><Link href="/admin/directory/relationships" style={{ color: "#050505", textDecoration: "none", background:"#ff6a00", padding: "11px 14px", borderRadius: 8,fontWeight:900 }}>Relationships</Link><Link href="/admin/directory" style={{ color: "#fff", textDecoration: "none", border: "1px solid #333", padding: "11px 14px", borderRadius: 8 }}>← Control Center</Link></div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
          {(["coaches","teams","leagues"] as Kind[]).map((tab) => (
            <button key={tab} onClick={() => { setKind(tab); cancel(); }} style={{ padding: "11px 15px", borderRadius: 8, border: "1px solid #333", background: kind === tab ? "#ff6a00" : "#111", color: kind === tab ? "#050505" : "#fff", fontWeight: 900, textTransform: "uppercase" }}>
              {tab}
            </button>
          ))}
          <button onClick={startNew} style={{ marginLeft: "auto", padding: "11px 15px", borderRadius: 8, border: 0, background: "#ff6a00", color: "#050505", fontWeight: 950 }}>+ Add {kind.slice(0,-1)}</button>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={"Search " + kind + "..."} style={inputStyle} />
        </div>

        {editing && (
          <section style={{ background: "#101010", border: "1px solid #292929", borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <h2 style={{ marginTop: 0 }}>{editing === "new" ? "Add record" : "Edit record"}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
              <label>Name<input style={inputStyle} value={String(form.name || "")} onChange={(e) => setForm({...form,name:e.target.value})} /></label>
              {kind !== "leagues" && <label>Country<input style={inputStyle} value={String(form.country || "")} onChange={(e) => setForm({...form,country:e.target.value})} /></label>}
              {kind !== "leagues" && <label>City<input style={inputStyle} value={String(form.city || "")} onChange={(e) => setForm({...form,city:e.target.value})} /></label>}
              {kind === "coaches" && <label>Current Team<select style={inputStyle} value={String(form.current_team_id || "")} onChange={(e) => setForm({...form,current_team_id:e.target.value})}><option value="">None</option>{teams.filter(t=>t.active).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
              {kind === "teams" && <>
                <label>League<select style={inputStyle} value={String(form.league_id || "")} onChange={(e) => setForm({...form,league_id:e.target.value})}><option value="">None</option>{leagues.filter(l=>l.active).map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
                <label>Legacy League Name<input style={inputStyle} value={String(form.league_name || "")} onChange={(e) => setForm({...form,league_name:e.target.value})} /></label>
              </>}
              {kind === "leagues" && <>
                <label>Level<input style={inputStyle} value={String(form.level || "")} onChange={(e) => setForm({...form,level:e.target.value})} /></label>
                <label>Season<input style={inputStyle} value={String(form.season || "")} onChange={(e) => setForm({...form,season:e.target.value})} /></label>
              </>}
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="checkbox" checked={Boolean(form.active)} onChange={(e) => setForm({...form,active:e.target.checked})} /> Active</label>
            </div>
            <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
              <button onClick={save} disabled={saving} style={{ padding: "11px 16px", border: 0, borderRadius: 8, background: "#ff6a00", fontWeight: 900 }}>{saving ? "Saving..." : "Save"}</button>
              <button onClick={cancel} style={{ padding: "11px 16px", border: "1px solid #333", borderRadius: 8, background: "#111", color: "#fff" }}>Cancel</button>
            </div>
          </section>
        )}

        {message && <div style={{ padding: 12, marginBottom: 15, borderRadius: 8, background: "#151515", border: "1px solid #333" }}>{message}</div>}

        {loading ? <p style={{ color: "#888" }}>Loading...</p> : (
          <div style={{ display: "grid", gap: 10 }}>
            {items.map((item) => (
              <article key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 15, alignItems: "center", padding: 16, background: "#0e0e0e", border: "1px solid #252525", borderRadius: 10 }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 17 }}>{item.name}</div>
                  <div style={{ color: "#888", fontSize: 13, marginTop: 5 }}>
                    {item.country || "Country not listed"}
                    {"city" in item && item.city ? " • " + item.city : ""}
                    {"level" in item && item.level ? " • " + item.level : ""}
                    {"league_name" in item && item.league_name ? " • " + item.league_name : ""}
                    {!item.active ? " • ARCHIVED" : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 7 }}>
                  <button onClick={() => startEdit(item)} style={{ padding: "8px 11px", borderRadius: 7, border: "1px solid #333", background: "#151515", color: "#fff" }}>Edit</button>
                  {item.active && <button onClick={() => archive(item.id)} style={{ padding: "8px 11px", borderRadius: 7, border: "1px solid #542b20", background: "#1a100c", color: "#ff9a70" }}>Archive</button>}
                  <button onClick={() => deleteRecord(item.id)} style={{ padding: "8px 11px", borderRadius: 7, border: "1px solid #7a2d2d", background: "#1a0b0b", color: "#ff8f8f" }}>Delete</button>
                </div>
              </article>
            ))}
            {!items.length && <div style={{ padding: 30, textAlign: "center", color: "#777", border: "1px dashed #333", borderRadius: 10 }}>No records found.</div>}
          </div>
        )}
      </div>
    </main>
  );
}
