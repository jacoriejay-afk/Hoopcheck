"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type RequestStatus = "open" | "in_progress" | "waiting_on_user" | "completed" | "denied";
type PrivacyRequest = {
  id: string;
  requester_id: string;
  request_type: "access" | "correction" | "deletion" | "export" | "privacy_question";
  details: string;
  status: RequestStatus;
  admin_notes: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

const requestLabels: Record<PrivacyRequest["request_type"], string> = {
  access: "Access my data",
  correction: "Correct my data",
  deletion: "Request data deletion",
  export: "Export my data",
  privacy_question: "Privacy question",
};

const statuses: { value: RequestStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting_on_user", label: "Waiting on user" },
  { value: "completed", label: "Completed" },
  { value: "denied", label: "Denied" },
];

export default function AdminPrivacyRequestsPage() {
  const [rows, setRows] = useState<PrivacyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("active");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { status: RequestStatus; admin_notes: string }>>({});

  async function load() {
    setLoading(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }
    setUserId(user.id);
    const { data: isAdmin, error: adminError } = await supabase.rpc("is_current_user_admin_or_moderator");
    if (adminError || !isAdmin) {
      window.location.href = "/dashboard";
      return;
    }

    let query = supabase
      .from("privacy_requests")
      .select("id,requester_id,request_type,details,status,admin_notes,assigned_to,created_at,updated_at,completed_at")
      .order("created_at", { ascending: false })
      .limit(300);

    if (filter === "active") query = query.in("status", ["open", "in_progress", "waiting_on_user"]);
    if (filter === "completed") query = query.in("status", ["completed", "denied"]);

    const { data, error: loadError } = await query;
    if (loadError) {
      setError("Could not load privacy requests. Check the admin policy and try again.");
      setRows([]);
    } else {
      const items = (data ?? []) as PrivacyRequest[];
      setRows(items);
      setDrafts((current) => {
        const next = { ...current };
        for (const item of items) {
          if (!next[item.id]) next[item.id] = { status: item.status, admin_notes: item.admin_notes ?? "" };
        }
        return next;
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [filter]);

  async function save(row: PrivacyRequest) {
    if (!userId) return;
    const draft = drafts[row.id];
    if (!draft) return;
    setSavingId(row.id);
    setMessage("");
    setError("");

    const completed = draft.status === "completed" || draft.status === "denied";
    const { error: updateError } = await supabase
      .from("privacy_requests")
      .update({
        status: draft.status,
        admin_notes: draft.admin_notes.trim() || null,
        assigned_to: row.assigned_to ?? userId,
        updated_at: new Date().toISOString(),
        completed_at: completed ? (row.completed_at ?? new Date().toISOString()) : null,
      })
      .eq("id", row.id);

    if (updateError) {
      setError("Could not save this request. " + updateError.message);
    } else {
      setMessage("Privacy request updated.");
      await load();
    }
    setSavingId(null);
  }

  return (
    <main className="page-shell">
      <div className="page-container">
        <header className="topbar">
          <Link href="/admin/directory" className="brand">HOOPCHECK ADMIN</Link>
          <nav className="topnav">
            <Link href="/admin/users">Users</Link>
            <Link href="/admin/support">Support</Link>
            <Link href="/privacy-center">Privacy Center</Link>
            <Link href="/dashboard">Dashboard</Link>
          </nav>
        </header>

        <section className="hero-card">
          <p className="eyebrow">ADMIN · PRIVACY</p>
          <h1>Privacy requests</h1>
          <p className="muted">Review data access, correction, deletion, and export requests. Verify the requester’s identity before disclosing or changing personal data.</p>
        </section>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 18 }}>
          <label htmlFor="privacy-filter">Show</label>
          <select id="privacy-filter" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ minWidth: 180 }}>
            <option value="active">Open and in progress</option>
            <option value="all">All requests</option>
            <option value="completed">Completed or denied</option>
          </select>
          <button className="btn dark" onClick={() => void load()} disabled={loading}>Refresh</button>
        </div>

        {message && <div className="dashboard-card" role="status" style={{ marginTop: 16 }}>{message}</div>}
        {error && <div className="message error" role="alert" style={{ marginTop: 16 }}>{error}</div>}

        <section style={{ display: "grid", gap: 14, marginTop: 20 }}>
          {loading ? <div className="dashboard-card">Loading privacy requests…</div> : rows.length === 0 ? (
            <div className="dashboard-card"><h2>No requests found.</h2><p className="muted">Requests will appear here when members submit them.</p></div>
          ) : rows.map((row) => {
            const draft = drafts[row.id] ?? { status: row.status, admin_notes: row.admin_notes ?? "" };
            return (
              <article key={row.id} className="dashboard-card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <p className="eyebrow">{requestLabels[row.request_type] ?? row.request_type}</p>
                    <h2 style={{ overflowWrap: "anywhere" }}>Request {row.id.slice(0, 8)}</h2>
                    <p className="muted">Requester ID: {row.requester_id}</p>
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Submitted {new Date(row.created_at).toLocaleString()}
                    {row.completed_at && <p>Closed {new Date(row.completed_at).toLocaleString()}</p>}
                  </div>
                </div>
                <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{row.details}</p>
                <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
                  <label htmlFor={"status-" + row.id}>Status</label>
                  <select id={"status-" + row.id} value={draft.status} onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: { ...draft, status: e.target.value as RequestStatus } }))}>
                    {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <label htmlFor={"notes-" + row.id}>Internal admin notes</label>
                  <textarea id={"notes-" + row.id} value={draft.admin_notes} maxLength={5000} onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: { ...draft, admin_notes: e.target.value } }))} placeholder="Record identity verification, actions taken, or reasons for denial." style={{ width: "100%", minHeight: 88 }} />
                  <button className="btn" disabled={savingId === row.id} onClick={() => void save(row)}>{savingId === row.id ? "Saving…" : "Save request"}</button>
                </div>
                <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>Status updates track the workflow only. Marking a request completed does not automatically export data or delete an account.</p>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
