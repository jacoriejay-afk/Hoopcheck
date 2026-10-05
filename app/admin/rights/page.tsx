"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type RightsRow = {
  id: string;
  country: string;
  country_code: string | null;
  league_name: string;
  league_short_name: string | null;
  data_owner: string | null;
  research_lead: string | null;
  research_status: "research_required" | "research_in_progress" | "research_complete";
  commercial_use_allowed: boolean | null;
  redistribution_allowed: boolean | null;
  production_approved: boolean;
  workflow_status: string;
  license_path: string | null;
  evidence_url: string | null;
  evidence_note: string | null;
  notes: string | null;
  last_verified_at: string | null;
};

const statusLabel: Record<RightsRow["research_status"], string> = {
  research_required: "Research required",
  research_in_progress: "In progress",
  research_complete: "Research complete",
};

export default function RightsCenterPage() {
  const [rows, setRows] = useState<RightsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "blocked" | "approved">("all");
  const [error, setError] = useState("");\n  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");

    const { data, error: loadError } = await supabase
      .from("rights_registry")
      .select("*")
      .order("country", { ascending: true })
      .order("league_name", { ascending: true });

    if (loadError) {
      setError(loadError.message);
      setRows([]);
    } else {
      setRows((data ?? []) as RightsRow[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    let mounted = true;

    async function boot() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (!session?.user) {
        window.location.href = "/login";
        return;
      }

      const { data: allowed, error: roleError } = await supabase.rpc(
        "is_current_user_admin_or_moderator"
      );

      if (!mounted) return;

      if (roleError || !allowed) {
        window.location.href = "/dashboard";
        return;
      }

      await load();
    }

    void boot();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesQuery =
        !needle ||
        [row.country, row.league_name, row.league_short_name, row.data_owner, row.research_lead]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));

      const matchesFilter =
        filter === "all" ||
        (filter === "blocked" && !row.production_approved) ||
        (filter === "approved" && row.production_approved);

      return matchesQuery && matchesFilter;
    });
  }, [rows, query, filter]);

  const workflow = ["research_required","research_complete","license_requested","license_verified","commercial_approved","redistribution_approved","production_approved"];\n\n  async function advance(row: RightsRow, to: string) {\n    setBusy(row.id); setError("");\n    const { data: { session } } = await supabase.auth.getSession();\n    const res = await fetch("/api/admin/rights/transition", { method: "POST", headers: { "Content-Type": "application/json", Authorization: \`Bearer \${session?.access_token || ""}\` }, body: JSON.stringify({ id: row.id, to_status: to }) });\n    const data = await res.json();\n    if (!res.ok) setError(data.error || "Transition failed."); else await load();\n    setBusy(null);\n  }\n\n  const approved = rows.filter((row) => row.production_approved).length;
  const blocked = rows.length - approved;
  const researchComplete = rows.filter(
    (row) => row.research_status === "research_complete"
  ).length;

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <div>
            <Link href="/admin/directory" style={styles.back}>
              ← Directory Control Center
            </Link>
            <p style={styles.eyebrow}>HOOPCHECK ADMIN</p>
            <h1 style={styles.title}>Rights & Coverage Center</h1>
            <p style={styles.subtitle}>
              The legal gate between basketball research and production data.
            </p>
          </div>

          <button onClick={() => void load()} style={styles.refresh}>
            Refresh Registry
          </button>
        </header>

        <div style={styles.rule}>
          <strong>Core rule:</strong> a data-provider relationship is not
          redistribution permission. Production stays blocked until commercial
          use and redistribution are explicitly cleared.
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <section style={styles.stats}>
          <Stat label="Markets tracked" value={rows.length} />
          <Stat label="Research complete" value={researchComplete} />
          <Stat label="Production blocked" value={blocked} />
          <Stat label="Production approved" value={approved} />
        </section>

        <section style={styles.panel}>
          <div style={styles.toolbar}>
            <input
              aria-label="Search rights registry"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search country, league, provider..."
              style={styles.input}
            />

            <div style={styles.filters}>
              {(["all", "blocked", "approved"] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  style={{
                    ...styles.filterButton,
                    ...(filter === value ? styles.filterActive : {}),
                  }}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={styles.empty}>Loading rights registry...</div>
          ) : filteredRows.length === 0 ? (
            <div style={styles.empty}>No registry records match this filter.</div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Market</th>
                    <th style={styles.th}>Research</th>
                    <th style={styles.th}>Commercial</th>
                    <th style={styles.th}>Redistribution</th>
                    <th style={styles.th}>Production</th>
                    <th style={styles.th}>Lead / owner</th>
                    <th style={styles.th}>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.id}>
                      <td style={styles.td}>
                        <strong>{row.country}</strong>
                        <span style={styles.league}>{row.league_name}</span>
                        {row.league_short_name && (
                          <small>{row.league_short_name}</small>
                        )}
                      </td>
                      <td style={styles.td}>
                        <Badge
                          text={statusLabel[row.research_status]}
                          tone={row.research_status === "research_complete" ? "green" : "amber"}
                        />
                      </td>
                      <td style={styles.td}>
                        <Permission value={row.commercial_use_allowed} />
                      </td>
                      <td style={styles.td}>
                        <Permission value={row.redistribution_allowed} />
                      </td>
                      <td style={styles.td}>
                        <Badge
                          text={row.production_approved ? "Approved" : "Blocked"}
                          tone={row.production_approved ? "green" : "red"}
                        />
                      </td>
                      <td style={styles.td}>
                        <strong>{row.research_lead || "Research required"}</strong>
                        <span style={styles.league}>
                          {row.data_owner || "Data owner not confirmed"}
                        </span>
                      </td>
                      <td style={styles.td}>
                        {row.evidence_url ? (
                          <a
                            href={row.evidence_url}
                            target="_blank"
                            rel="noreferrer"
                            style={styles.link}
                          >
                            Open evidence ↗
                          </a>
                        ) : (
                          <span style={styles.muted}>Not recorded</span>
                        )}
                        <span style={styles.note}>
                          {row.evidence_note || row.notes || ""}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.stat}>
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </div>
  );
}

function Permission({ value }: { value: boolean | null }) {
  if (value === true) return <Badge text="Approved" tone="green" />;
  if (value === false) return <Badge text="Blocked" tone="red" />;
  return <Badge text="Unverified" tone="amber" />;
}

function Badge({ text, tone }: { text: string; tone: "green" | "red" | "amber" }) {
  return (
    <span
      style={{
        ...styles.badge,
        ...(tone === "green"
          ? styles.green
          : tone === "red"
            ? styles.red
            : styles.amber),
      }}
    >
      {text}
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 50% -10%, rgba(255,106,0,0.14), transparent 35%), #050505",
    color: "#fff",
    padding: "40px 20px 80px",
  },
  shell: { width: "min(1380px, 100%)", margin: "0 auto" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 20,
    flexWrap: "wrap",
    marginBottom: 22,
  },
  back: { color: "#999", textDecoration: "none", fontSize: 13, display: "inline-block", marginBottom: 18 },
  eyebrow: { margin: "0 0 8px", color: "#ff6a00", fontSize: 11, fontWeight: 900, letterSpacing: ".15em" },
  title: { margin: 0, fontSize: "clamp(2.2rem, 5vw, 4rem)", lineHeight: .98, letterSpacing: "-.06em", fontWeight: 950 },
  subtitle: { color: "#888", margin: "12px 0 0", maxWidth: 680 },
  refresh: { background: "#ff6a00", border: 0, borderRadius: 9, padding: "12px 16px", fontWeight: 900, cursor: "pointer" },
  rule: { border: "1px solid rgba(255,106,0,.3)", background: "rgba(255,106,0,.06)", borderRadius: 12, padding: "14px 16px", color: "#d5d5d5", marginBottom: 18, lineHeight: 1.55 },
  error: { border: "1px solid rgba(255,70,70,.35)", background: "rgba(255,70,70,.08)", color: "#ff9292", padding: 13, borderRadius: 10, marginBottom: 18 },
  stats: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 18 },
  stat: { background: "#111", border: "1px solid #252525", borderRadius: 12, padding: 17 },
  statSpan: {},
  panel: { background: "#101010", border: "1px solid #252525", borderRadius: 15, padding: 18 },
  toolbar: { display: "flex", gap: 10, justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap" },
  input: { flex: "1 1 320px", minHeight: 44, background: "#080808", border: "1px solid #303030", borderRadius: 9, color: "#fff", padding: "0 13px", outline: "none" },
  filters: { display: "flex", gap: 7 },
  filterButton: { background: "#171717", color: "#aaa", border: "1px solid #2d2d2d", borderRadius: 8, padding: "0 12px", minHeight: 42, cursor: "pointer", textTransform: "capitalize" as const },
  filterActive: { color: "#050505", background: "#ff6a00", borderColor: "#ff6a00" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" as const, minWidth: 1050 },
  th: { textAlign: "left" as const, padding: "11px 10px", color: "#666", fontSize: 10, textTransform: "uppercase" as const, letterSpacing: ".1em", borderBottom: "1px solid #2a2a2a" },
  td: { padding: "15px 10px", borderBottom: "1px solid #202020", verticalAlign: "top", fontSize: 13 },
  league: { display: "block", color: "#aaa", marginTop: 4 },
  note: { display: "block", color: "#777", marginTop: 6, lineHeight: 1.4, maxWidth: 330, fontSize: 11 },
  muted: { color: "#666" },
  link: { color: "#ff9a50", textDecoration: "none", fontWeight: 800 },
  badge: { display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "5px 8px", fontSize: 10, fontWeight: 900, whiteSpace: "nowrap" as const },
  green: { color: "#b8f2cf", background: "rgba(60,190,110,.1)", border: "1px solid rgba(60,190,110,.25)" },
  red: { color: "#ffadad", background: "rgba(255,60,60,.08)", border: "1px solid rgba(255,60,60,.25)" },
  amber: { color: "#ffd28d", background: "rgba(255,170,60,.08)", border: "1px solid rgba(255,170,60,.25)" },
  empty: { padding: 45, textAlign: "center" as const, color: "#777" },
};
