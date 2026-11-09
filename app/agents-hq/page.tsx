"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";

type Role = "agent" | "scout";

/** Agent / Scout HQ is a navigation workspace, not an authorization boundary.
 * Profile and recruiting endpoints continue to enforce their own permissions.
 */
export default function AgentsHQPage() {
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!active) return;
        if (authError) throw authError;
        if (!user) { window.location.replace("/login?returnTo=/agents-hq"); return; }
        const { data, error: profileError } = await supabase.from("profiles")
          .select("account_type").eq("id", user.id).maybeSingle();
        if (!active) return;
        if (profileError) throw profileError;
        if (data?.account_type !== "agent" && data?.account_type !== "scout") {
          window.location.replace("/dashboard");
          return;
        }
        setRole(data.account_type);
      } catch {
        if (active) setError("Your account could not be verified. Try again.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) return <main className="page-shell"><div className="page-container"><HoopLoading label="Opening Agents HQ…" /></div></main>;
  if (error) return <main className="page-shell"><div className="page-container"><section className="state-card error"><h1>Agents HQ unavailable</h1><p>{error}</p><button className="btn" onClick={() => window.location.reload()}>Retry</button></section></div></main>;
  if (!role) return null;
  return <main className="page-shell"><div className="page-container">
    <header className="hero-card">
      <p className="eyebrow">{role === "agent" ? "AGENT WORKSPACE" : "SCOUT WORKSPACE"}</p>
      <h1>Agents HQ</h1>
      <p className="muted">Discover basketball talent, research teams and manage professional connections. Player and club management controls are kept separate.</p>
    </header>
    <section className="hc-dashboard-grid" aria-label="Agent and scout tools">
      <article className="dashboard-card"><h2>Find players</h2><p className="muted">Search public player profiles by name and country.</p><Link className="btn" href="/players">Explore players</Link></article>
      <article className="dashboard-card"><h2>Research teams</h2><p className="muted">Explore clubs and their public profiles across leagues.</p><Link className="btn" href="/directory">Team directory</Link></article>
      <article className="dashboard-card"><h2>Connections</h2><p className="muted">Review your network and access permitted player outreach.</p><Link className="btn" href="/connections">Open connections</Link></article>
    </section>
  </div></main>;
}
