"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type Inquiry = { id: string; name: string; email: string; type: string; message: string; created_at: string };

export default function AdminBusinessInquiriesPage() {
  const [rows, setRows] = useState<Inquiry[]>([]);
  const [status, setStatus] = useState("Checking administrator access…");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setRows([]);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      setStatus("Please sign in with an administrator account to review business inquiries.");
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc("admin_list_public_business_inquiries", { p_limit: 50 });
    if (error) {
      setStatus(error.code === "42501" ? "Administrator access required." : "The inquiry inbox is not available yet. Contact the site administrator.");
    } else {
      setRows((data || []) as Inquiry[]);
      setStatus(data?.length ? "" : "No guest inquiries yet.");
    }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <main className="page-shell"><div className="page-container">
    <section className="hero-card"><p className="eyebrow">HOOPCHECK BUSINESS ADMIN</p><h1>Guest business inquiries</h1>
      <p className="muted">Private sponsorship and partnership messages. Access is enforced by the database administrator role.</p>
      <Link href="/admin/users">Back to admin accounts</Link></section>
    <section className="dashboard-card" style={{ marginTop: 18 }}>
      <button className="btn" type="button" disabled={loading} onClick={() => void load()}>{loading ? "Loading…" : "Refresh inquiries"}</button>
      {status && <p role="status" className="muted">{status}</p>}
      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        {rows.map(row => <article className="card" key={row.id} style={{ overflowWrap: "anywhere" }}>
          <p className="eyebrow">{row.type} · {new Date(row.created_at).toLocaleString()}</p>
          <h2>{row.name}</h2>
          <p><a href={`mailto:${encodeURIComponent(row.email)}`}>{row.email}</a></p>
          <p style={{ whiteSpace: "pre-wrap" }}>{row.message}</p>
        </article>)}
      </div>
    </section>
  </div></main>;
}
