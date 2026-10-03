"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Source = {
  id: string;
  name: string;
  base_url: string | null;
  documentation_url: string | null;
  license_notes: string | null;
  active: boolean;
};

type SyncRun = {
  id: string;
  source_id: string | null;
  entity_type: string;
  status: string;
  records_seen: number;
  records_created: number;
  records_updated: number;
  records_skipped: number;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
};

export default function DirectoryAdminPage() {
  const router = useRouter();

  const [sources, setSources] = useState<Source[]>([]);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");

  async function loadDirectory() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      router.replace("/login");
      return;
    }

    const { data: role } = await supabase
      .from("admin_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (
      !role ||
      !["admin", "moderator"].includes(
        String(role.role).trim().toLowerCase()
      )
    ) {
      router.replace("/dashboard");
      return;
    }

    const [{ data: sourceData }, { data: runData }] = await Promise.all([
      supabase
        .from("directory_sources")
        .select("*")
        .order("name"),
      supabase
        .from("directory_sync_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(25),
    ]);

    setSources((sourceData ?? []) as Source[]);
    setRuns((runData ?? []) as SyncRun[]);
    setLoading(false);
  }

  useEffect(() => {
    loadDirectory();
  }, []);

  async function toggleSource(source: Source) {
    setMessage("");

    const { error } = await supabase
      .from("directory_sources")
      .update({ active: !source.active })
      .eq("id", source.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(
      `${source.name} is now ${source.active ? "disabled" : "enabled"}.`
    );

    await loadDirectory();
  }

  async function runTheSportsDBLeagues() {
    setSyncing(true);
    setMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/directory-sync-thesportsdb`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mode: "leagues",
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "TheSportsDB sync failed.");
      }

      setMessage(
        `TheSportsDB sync complete: ${result.records_created ?? 0} created, ${
          result.records_updated ?? 0
        } updated.`
      );

      await loadDirectory();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Sync failed."
      );
    } finally {
      setSyncing(false);
    }
  }

  async function testSportradar() {
    setSyncing(true);
    setMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const source = sources.find(
        (item) => item.name === "Sportradar Global Basketball"
      );

      if (!source) {
        throw new Error("Sportradar source was not found.");
      }

      if (!source.active) {
        throw new Error(
          "Sportradar is disabled until the API credential and licensing are ready."
        );
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/directory-sync-sportradar`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mode: "leagues",
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Sportradar sync failed.");
      }

      setMessage(
        `Sportradar sync complete: ${
          result.records_created ?? 0
        } created, ${result.records_updated ?? 0} updated.`
      );

      await loadDirectory();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Sportradar test failed."
      );
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <main className="directory-page">
        <div className="directory-shell">
          <p className="directory-loading">Loading directory control center...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="directory-page">
      <div className="directory-shell">
        <header className="directory-header">
          <div>
            <p className="directory-eyebrow">HOOPCHECK ADMIN</p>
            <h1>Directory Control Center</h1>
            <p>
              Manage worldwide basketball data providers and synchronization.
            </p>
          </div>

          <button
            className="directory-back"
            onClick={() => router.push("/admin/reviews")}
          >
            ← Moderation
          </button>
        </header>

        {message && (
          <div className="directory-message">
            {message}
          </div>
        )}

        <section className="directory-card">
          <div className="directory-card-header">
            <div>
              <h2>Data Providers</h2>
              <p>
                Providers supply the worldwide league and team directory.
              </p>
            </div>
          </div>

          <div className="provider-grid">
            {sources.map((source) => (
              <article className="provider-card" key={source.id}>
                <div className="provider-top">
                  <div>
                    <span
                      className={`provider-status ${
                        source.active ? "enabled" : "disabled"
                      }`}
                    >
                      {source.active ? "ENABLED" : "DISABLED"}
                    </span>

                    <h3>{source.name}</h3>
                  </div>
                </div>

                <p className="provider-url">
                  {source.base_url ?? "No API endpoint configured"}
                </p>

                <p className="provider-license">
                  {source.license_notes ??
                    "No licensing notes recorded."}
                </p>

                <div className="provider-actions">
                  <button
                    onClick={() => toggleSource(source)}
                    className="secondary-button"
                  >
                    {source.active ? "Disable" : "Enable"}
                  </button>

                  {source.documentation_url && (
                    <a
                      href={source.documentation_url}
                      target="_blank"
                      rel="noreferrer"
                      className="secondary-button"
                    >
                      Documentation
                    </a>
                  )}

                  {source.name === "TheSportsDB" && source.active && (
                    <button
                      onClick={runTheSportsDBLeagues}
                      disabled={syncing}
                      className="primary-button"
                    >
                      {syncing ? "Syncing..." : "Sync Leagues"}
                    </button>
                  )}

                  {source.name === "Sportradar Global Basketball" && (
                    <button
                      onClick={testSportradar}
                      disabled={syncing || !source.active}
                      className="primary-button"
                    >
                      {syncing ? "Testing..." : "Sync Leagues"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="directory-card">
          <div className="directory-card-header">
            <div>
              <h2>Recent Sync History</h2>
              <p>Latest directory synchronization activity.</p>
            </div>
          </div>

          {runs.length === 0 ? (
            <div className="empty-state">
              No synchronization runs yet.
            </div>
          ) : (
            <div className="sync-table-wrapper">
              <table className="sync-table">
                <thead>
                  <tr>
                    <th>Entity</th>
                    <th>Status</th>
                    <th>Seen</th>
                    <th>Created</th>
                    <th>Updated</th>
                    <th>Skipped</th>
                    <th>Started</th>
                  </tr>
                </thead>

                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id}>
                      <td>{run.entity_type}</td>
                      <td>
                        <span
                          className={`sync-status ${run.status}`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td>{run.records_seen}</td>
                      <td>{run.records_created}</td>
                      <td>{run.records_updated}</td>
                      <td>{run.records_skipped}</td>
                      <td>
                        {new Date(run.started_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="directory-card roadmap-card">
          <h2>Directory Roadmap</h2>

          <div className="roadmap-grid">
            <div className="roadmap-item complete">
              <strong>01</strong>
              <span>Provider registry</span>
            </div>

            <div className="roadmap-item complete">
              <strong>02</strong>
              <span>Normalized database</span>
            </div>

            <div className="roadmap-item complete">
              <strong>03</strong>
              <span>Sync history</span>
            </div>

            <div className="roadmap-item">
              <strong>04</strong>
              <span>Sportradar credentials</span>
            </div>

            <div className="roadmap-item">
              <strong>05</strong>
              <span>Global league import</span>
            </div>

            <div className="roadmap-item">
              <strong>06</strong>
              <span>Global team import</span>
            </div>

            <div className="roadmap-item">
              <strong>07</strong>
              <span>Coach directory</span>
            </div>

            <div className="roadmap-item">
              <strong>08</strong>
              <span>User corrections</span>
            </div>
          </div>
        </section>
      </div>

      <style jsx>{`
        .directory-page {
          min-height: 100vh;
          background: #090909;
          color: #fff;
          padding: 32px 18px 70px;
        }

        .directory-shell {
          width: min(1200px, 100%);
          margin: 0 auto;
        }

        .directory-header {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          align-items: flex-start;
          margin-bottom: 28px;
        }

        .directory-eyebrow {
          color: #ff6a00;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 2px;
          margin: 0 0 8px;
        }

        h1 {
          margin: 0;
          font-size: clamp(32px, 6vw, 54px);
          line-height: 0.98;
          font-weight: 950;
          letter-spacing: -2px;
        }

        .directory-header p {
          color: #a8a8a8;
          margin: 12px 0 0;
        }

        .directory-back,
        .secondary-button,
        .primary-button {
          border: 0;
          border-radius: 10px;
          padding: 11px 15px;
          font-weight: 900;
          cursor: pointer;
        }

        .directory-back,
        .secondary-button {
          background: #181818;
          color: #fff;
          border: 1px solid #303030;
        }

        .primary-button {
          background: #ff6a00;
          color: #090909;
        }

        .primary-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .directory-message {
          border: 1px solid #ff6a00;
          background: rgba(255, 106, 0, 0.08);
          color: #ff9a55;
          padding: 14px 16px;
          border-radius: 12px;
          margin-bottom: 20px;
        }

        .directory-card {
          background: #111;
          border: 1px solid #252525;
          border-radius: 16px;
          padding: 22px;
          margin-bottom: 20px;
          overflow: hidden;
        }

        .directory-card-header {
          margin-bottom: 20px;
        }

        .directory-card h2 {
          margin: 0;
          font-size: 22px;
          font-weight: 950;
        }

        .directory-card-header p {
          color: #858585;
          margin: 7px 0 0;
        }

        .provider-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .provider-card {
          border: 1px solid #2b2b2b;
          background: #0c0c0c;
          border-radius: 14px;
          padding: 18px;
        }

        .provider-top {
          display: flex;
          justify-content: space-between;
        }

        .provider-status,
        .sync-status {
          display: inline-flex;
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.7px;
        }

        .provider-status.enabled {
          background: rgba(50, 205, 50, 0.12);
          color: #62db62;
        }

        .provider-status.disabled {
          background: #202020;
          color: #888;
        }

        .provider-card h3 {
          margin: 12px 0 0;
          font-size: 20px;
          font-weight: 950;
        }

        .provider-url {
          color: #777;
          font-size: 12px;
          word-break: break-all;
          margin: 14px 0;
        }

        .provider-license {
          color: #aaa;
          font-size: 13px;
          line-height: 1.5;
          min-height: 58px;
        }

        .provider-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 18px;
        }

        .provider-actions a {
          text-decoration: none;
        }

        .sync-table-wrapper {
          overflow-x: auto;
        }

        .sync-table {
          width: 100%;
          min-width: 760px;
          border-collapse: collapse;
        }

        .sync-table th,
        .sync-table td {
          text-align: left;
          padding: 13px 10px;
          border-bottom: 1px solid #242424;
          font-size: 13px;
        }

        .sync-table th {
          color: #777;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.7px;
        }

        .sync-status.completed {
          color: #65dc65;
          background: rgba(50, 205, 50, 0.1);
        }

        .sync-status.running {
          color: #ffad64;
          background: rgba(255, 106, 0, 0.1);
        }

        .sync-status.failed {
          color: #ff6666;
          background: rgba(255, 60, 60, 0.1);
        }

        .empty-state,
        .directory-loading {
          color: #777;
          padding: 24px 0;
        }

        .roadmap-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .roadmap-item {
          border: 1px solid #282828;
          background: #0c0c0c;
          padding: 15px;
          border-radius: 12px;
        }

        .roadmap-item strong {
          display: block;
          color: #555;
          font-size: 11px;
          margin-bottom: 8px;
        }

        .roadmap-item span {
          font-weight: 800;
          font-size: 13px;
          color: #aaa;
        }

        .roadmap-item.complete {
          border-color: rgba(255, 106, 0, 0.35);
        }

        .roadmap-item.complete strong,
        .roadmap-item.complete span {
          color: #ff6a00;
        }

        @media (max-width: 800px) {
          .provider-grid,
          .roadmap-grid {
            grid-template-columns: 1fr;
          }

          .directory-header {
            flex-direction: column;
          }

          .directory-back {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
