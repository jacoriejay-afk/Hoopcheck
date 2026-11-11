"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";

type Season = {
  season_start_month: number; season_start_day: number;
  season_end_month: number; season_end_day: number;
  season_label: string | null; season_time_zone: string | null;
};
const defaults: Season = { season_start_month: 9, season_start_day: 1, season_end_month: 6, season_end_day: 30, season_label: null, season_time_zone: null };
const numberFields = ["season_start_month", "season_start_day", "season_end_month", "season_end_day"] as const;

export default function LeagueSeasonEditor() {
  const [leagueId, setLeagueId] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const [form, setForm] = useState<Season>(defaults);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState("");
  async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Sign in to edit league seasons.");
    return { Authorization: `Bearer ${session.access_token}` };
  }
  async function load() {
    setBusy(true); setMessage(""); setPreview("");
    try {
      if (!/^[0-9a-f-]{36}$/i.test(leagueId)) throw new Error("Enter a valid league UUID.");
      const { data, error } = await supabase.from("leagues")
        .select("id,name,season_start_month,season_start_day,season_end_month,season_end_day,season_label,season_time_zone")
        .eq("id", leagueId).single();
      if (error || !data) throw new Error(error?.message || "League not found.");
      setLeagueName(data.name);
      setForm({ season_start_month: data.season_start_month, season_start_day: data.season_start_day, season_end_month: data.season_end_month, season_end_day: data.season_end_day, season_label: data.season_label, season_time_zone: data.season_time_zone });
      setMessage("Review the season window and save only after verifying the league calendar.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load league."); }
    finally { setBusy(false); }
  }
  async function save() {
    setBusy(true); setMessage(""); setPreview("");
    try {
      const headers = await authHeaders();
      const response = await fetch(`/api/admin/leagues/${encodeURIComponent(leagueId)}/season`, {
        method: "PATCH", headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Save failed");
      setPreview(`Current status: ${payload.preview.inSeason ? "In season" : "Off season"} · ${payload.preview.seasonLabel} · Next start: ${payload.preview.nextStartMonth} · Timezone: ${payload.league.season_time_zone || "UTC (unverified)"}`);
      setMessage("Season settings saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save."); }
    finally { setBusy(false); }
  }
  const inputStyle = { padding: "10px 12px", borderRadius: 12, border: "1px solid var(--border, #555)", background: "var(--card, #202020)", color: "inherit", width: "100%" };
  return <main style={{ maxWidth: 700, margin: "0 auto", padding: 24 }}>
    <Link href="/admin/directory/manage?kind=leagues-mens">Back to directory manager</Link>
    <h1>League season settings</h1>
    <p>Set recurring competition dates. Timezones must use IANA names (for example, Europe/Baku). Leave timezone blank until verified.</p>
    <label>League ID<input style={inputStyle} value={leagueId} onChange={event => setLeagueId(event.target.value.trim())} placeholder="League UUID" /></label>
    <button type="button" disabled={busy} onClick={load}>Load league</button>
    {leagueName && <section style={{ marginTop: 24, display: "grid", gap: 16 }}>
      <h2>{leagueName}</h2>
      {numberFields.map(field => <label key={field}>{field.replaceAll("_", " ")}
        <input type="number" min={field.endsWith("month") ? 1 : 1} max={field.endsWith("month") ? 12 : 31} style={inputStyle} value={form[field]} onChange={event => setForm(previous => ({ ...previous, [field]: Number(event.target.value) }))} />
      </label>)}
      <label>Season label (optional)<input style={inputStyle} value={form.season_label || ""} onChange={event => setForm(previous => ({ ...previous, season_label: event.target.value || null }))} /></label>
      <label>IANA timezone (optional)<input style={inputStyle} value={form.season_time_zone || ""} onChange={event => setForm(previous => ({ ...previous, season_time_zone: event.target.value || null }))} placeholder="Europe/Baku" /></label>
      <button type="button" disabled={busy} onClick={save}>Save verified season</button>
    </section>}
    {message && <p role="status">{message}</p>}
    {preview && <p role="status">{preview}</p>}
  </main>;
}
