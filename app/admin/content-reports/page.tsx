"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Logo from "../../../components/Logo";
import { supabase } from "../../../lib/supabase";
type ContentReport = { id: string; content_type: string; content_id: string; reporter_id: string | null; content_owner_id: string | null; content_snapshot: string; reason: string; status: string; created_at: string };
export default function ContentReportsPage() {
  const [rows, setRows] = useState<ContentReport[]>([]); const [loading, setLoading] = useState(true); const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("content_reports").select("id,content_type,content_id,reporter_id,content_owner_id,content_snapshot,reason,status,created_at").order("created_at", { ascending: false }).limit(300);
    if (error) setNotice("Could not load the moderation queue. Confirm moderator permissions and that the trust-and-safety migration is applied.");
    else { setRows((data || []) as ContentReport[]); setNotice(""); }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function setStatus(row: ContentReport, status: "reviewing" | "resolved" | "dismissed") {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("content_reports").update({ status, resolved_at: status === "resolved" || status === "dismissed" ? new Date().toISOString() : null, resolved_by: user?.id || null }).eq("id", row.id);
    if (error) setNotice("Could not update this report. Check moderator permissions."); else await load();
  }
  return <main className="page-shell admin-light-shell"><div className="page-container">
    <header className="topbar"><Link href="/admin/directory" className="brand" aria-label="HoopCheck Admin"><Logo variant="full" size={30} /></Link><nav className="topnav"><Link href="/admin/users">Users</Link><Link href="/admin/reviews">Reviews</Link><Link href="/admin/reports">Profile reports</Link></nav></header>
    <section className="hero-card"><p className="eyebrow">TRUST &amp; SAFETY</p><h1>Content moderation queue</h1><p className="muted">Review reports for reviews, HoopFeed posts, and chat messages. Report snapshots preserve the content and reason submitted by the reporter.</p></section>
    {notice && <p className="message" role="status">{notice}</p>}
    {loading ? <p className="muted">Loading reports…</p> : !rows.length ? <section className="dashboard-card"><h2>No reports in queue</h2><p className="muted">New reports will appear here.</p></section> : <section style={{ display:"grid", gap:12, marginTop:18 }}>
      {rows.map(row => <article className="dashboard-card" key={row.id}>
        <header style={{ display:"flex", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}><strong>{row.content_type.replaceAll("_"," ").toUpperCase()}</strong><span className="muted">{row.status.toUpperCase()} · {new Date(row.created_at).toLocaleString()}</span></header>
        <p><strong>Reason:</strong> {row.reason}</p><p><strong>Reported content:</strong></p><blockquote style={{ whiteSpace:"pre-wrap", overflowWrap:"anywhere" }}>{row.content_snapshot || "(No text snapshot available)"}</blockquote>
        <p className="muted">Reporter: {row.reporter_id || "Deleted account"}<br />Content owner: {row.content_owner_id || "Unknown/deleted"}<br />Content ID: {row.content_id}</p>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}><button className="btn dark" type="button" onClick={() => void setStatus(row,"reviewing")}>Mark reviewing</button><button className="btn" type="button" onClick={() => void setStatus(row,"resolved")}>Resolve</button><button className="btn dark" type="button" onClick={() => void setStatus(row,"dismissed")}>Dismiss</button></div>
      </article>)}
    </section>}
  </div></main>;
}
