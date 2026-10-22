"use client";

import { useEffect, useState } from "react";
import Logo from "../../../components/Logo";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { useLanguage } from "../../../components/LanguageProvider";

type ReportRow = {
  id: string;
  profile_id: string;
  reporter_id: string;
  reason: string;
  status: string;
  created_at: string;
};

export default function Reports() {
  const { t } = useLanguage();
  const [rows, setRows] = useState<ReportRow[]>([]);

  async function load() {
    const { data } = await supabase
      .from("profile_reports")
      .select("id,profile_id,reporter_id,reason,status,created_at")
      .order("created_at", { ascending: false });
    setRows(data ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function resolve(id: string, status: string) {
    await supabase.rpc("admin_resolve_profile_report", {
      p_report_id: id,
      p_status: status,
    });
    await load();
  }

  return (
    <main className="page-shell admin-light-shell">
      <div className="page-container">
        <header className="topbar">
          <Link href="/admin/directory" className="brand" aria-label="HoopCheck Admin"><Logo variant="full" size={30} /></Link>
          <nav className="topnav">
            <Link href="/admin/users">{t("users")}</Link>
            <Link href="/admin/reviews">{t("reviews")}</Link>
          </nav>
        </header>
        <section className="hero-card">
          <p className="eyebrow">{t("moderation")}</p>
          <h1>{t("profileReports")}</h1>
          <p className="muted">{t("researchAccountReportsDescription")}</p>
        </section>
        <section style={{ display: "grid", gap: 12, marginTop: 18 }}>
          {rows.map((row) => (
            <article className="dashboard-card" key={row.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <strong>{row.status.toUpperCase()}</strong>
                <small className="muted">{new Date(row.created_at).toLocaleString()}</small>
              </div>
              <p>{row.reason}</p>
              <p className="muted">
                {t("profile")}: {row.profile_id}<br />
                {t("reporter")}: {row.reporter_id}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn" onClick={() => void resolve(row.id, "resolved")}>{t("resolve")}</button>
                <button className="btn dark" onClick={() => void resolve(row.id, "dismissed")}>{t("dismiss")}</button>
                <Link className="btn dark" href={"/admin/users?q=" + row.profile_id}>{t("openUser")}</Link>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
