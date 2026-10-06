"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type CommentRow = {
  id: string;
  review_id: string;
  author_id: string;
  body: string;
  status: string;
  created_at: string;
};

export default function Comments() {
  const [rows, setRows] = useState<CommentRow[]>([]);

  async function load() {
    const { data } = await supabase
      .from("review_comments")
      .select("id,review_id,author_id,body,status,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    setRows(data ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function moderate(id: string, status: string) {
    await supabase.rpc("admin_moderate_review_comment", {
      p_comment_id: id,
      p_status: status,
    });
    await load();
  }

  return (
    <main className="page-shell">
      <div className="page-container">
        <header className="topbar">
          <Link href="/admin/directory" className="brand">HOOPCHECK ADMIN</Link>
          <nav className="topnav">
            <Link href="/admin/reviews">Reviews</Link>
            <Link href="/admin/users">Users</Link>
          </nav>
        </header>
        <section className="hero-card">
          <p className="eyebrow">MODERATION</p>
          <h1>Review Comments</h1>
          <p className="muted">Comments remain hidden from public view until approved.</p>
        </section>
        <section style={{ display: "grid", gap: 12, marginTop: 18 }}>
          {rows.map((row) => (
            <article className="dashboard-card" key={row.id}>
              <strong>{row.status.toUpperCase()}</strong>
              <p>{row.body}</p>
              <small className="muted">
                Author: {row.author_id} · Review: {row.review_id}
              </small>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button className="btn" onClick={() => void moderate(row.id, "approved")}>Approve</button>
                <button className="btn dark" onClick={() => void moderate(row.id, "rejected")}>Reject</button>
                <button className="btn dark" onClick={() => void moderate(row.id, "flagged")}>Flag</button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
