"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type DirectoryCounts = {
  coaches: number;
  teams: number;
  leagues: number;
};

export default function AdminDirectoryPage() {
  const router = useRouter();

  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<DirectoryCounts>({
    coaches: 0,
    teams: 0,
    leagues: 0,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadDirectory() {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (sessionError || !session?.user) {
        router.replace("/login");
        return;
      }

      const { data: isAdminOrModerator, error: roleError } =
        await supabase.rpc("is_current_user_admin_or_moderator");

      if (!mounted) return;

      if (roleError || !isAdminOrModerator) {
        router.replace("/dashboard");
        return;
      }

      const { data: adminRole, error: adminRoleError } = await supabase
        .from("admin_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!mounted) return;

      if (adminRoleError || !adminRole) {
        router.replace("/dashboard");
        return;
      }

      const normalizedRole = String(adminRole.role)
        .trim()
        .toLowerCase();

      if (
        normalizedRole !== "admin" &&
        normalizedRole !== "moderator"
      ) {
        router.replace("/dashboard");
        return;
      }

      const [
        { count: coachCount, error: coachError },
        { count: teamCount, error: teamError },
        { count: leagueCount, error: leagueError },
      ] = await Promise.all([
        supabase
          .from("coaches")
          .select("*", { count: "exact", head: true })
          .eq("active", true),

        supabase
          .from("teams")
          .select("*", { count: "exact", head: true })
          .eq("active", true),

        supabase
          .from("leagues")
          .select("*", { count: "exact", head: true })
          .eq("active", true),
      ]);

      if (!mounted) return;

      if (coachError || teamError || leagueError) {
        setError(
          coachError?.message ??
            teamError?.message ??
            leagueError?.message ??
            "Unable to load directory counts."
        );
      }

      setRole(normalizedRole);

      setCounts({
        coaches: coachCount ?? 0,
        teams: teamCount ?? 0,
        leagues: leagueCount ?? 0,
      });

      setLoading(false);
    }

    void loadDirectory();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.loader}>
          Loading directory controls...
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>HOOPCHECK ADMIN</p>

            <h1 style={styles.title}>
              Directory Control Center
            </h1>

            <p style={styles.subtitle}>
              Manage the worldwide basketball directory.
            </p>
          </div>

          <div style={styles.headerActions}>
            <Link
              href="/admin/reviews"
              style={styles.secondaryButton}
            >
              Review Queue
            </Link>

            <Link
              href="/dashboard"
              style={styles.secondaryButton}
            >
              Dashboard
            </Link>
          </div>
        </header>

        {error && (
          <div style={styles.errorBox}>
            {error}
          </div>
        )}

        <section style={styles.statsGrid}>
          <StatCard
            label="Active Coaches"
            value={counts.coaches}
            accent="#ff8a1f"
          />

          <StatCard
            label="Active Teams"
            value={counts.teams}
            accent="#f5b36a"
          />

          <StatCard
            label="Active Leagues"
            value={counts.leagues}
            accent="#ff6a00"
          />
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <p style={styles.sectionEyebrow}>
                DIRECTORY MANAGEMENT
              </p>

              <h2 style={styles.panelTitle}>
                Build the worldwide basketball database
              </h2>

              <p style={styles.panelText}>
                HoopCheck will connect coaches, teams, and leagues
                while keeping user reviews separate from imported
                directory data.
              </p>
            </div>

            <span style={styles.badge}>
              {role === "admin"
                ? "Admin Access"
                : "Moderator Access"}
            </span>
          </div>

          <div style={styles.cardGrid}>
            <DirectoryCard
              number="01"
              title="Coaches"
              description="Manage coach profiles, teams, countries, sources, and active status."
              href="/coaches"
            />

            <DirectoryCard
              number="02"
              title="Teams"
              description="Manage professional teams and connect each team to its league."
              href="/teams"
            />

            <DirectoryCard
              number="03"
              title="Leagues"
              description="Manage leagues, countries, seasons, and competition levels."
              href="/leagues"
            />

            <DirectoryCard
              number="04"
              title="Data Providers"
              description="Control licensed external data sources and synchronization."
              href="/admin/directory"
            />
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <p style={styles.sectionEyebrow}>
                DIRECTORY ROADMAP
              </p>

              <h2 style={styles.panelTitle}>
                Worldwide coverage
              </h2>
            </div>
          </div>

          <div style={styles.roadmap}>
            <RoadmapItem
              number="01"
              title="Database foundation"
              complete
            />

            <RoadmapItem
              number="02"
              title="Provider registry"
              complete
            />

            <RoadmapItem
              number="03"
              title="Coach directory"
            />

            <RoadmapItem
              number="04"
              title="Team directory"
            />

            <RoadmapItem
              number="05"
              title="League directory"
            />

            <RoadmapItem
              number="06"
              title="Coach → Team relationships"
            />

            <RoadmapItem
              number="07"
              title="Team → League relationships"
            />

            <RoadmapItem
              number="08"
              title="Licensed worldwide imports"
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div
      style={{
        ...styles.statCard,
        borderTop: `3px solid ${accent}`,
      }}
    >
      <span style={styles.statLabel}>{label}</span>

      <strong style={styles.statValue}>
        {value.toLocaleString()}
      </strong>
    </div>
  );
}

function DirectoryCard({
  number,
  title,
  description,
  href,
}: {
  number: string;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <article style={styles.card}>
      <span style={styles.cardNumber}>{number}</span>

      <h3 style={styles.cardTitle}>{title}</h3>

      <p style={styles.cardText}>{description}</p>

      <Link href={href} style={styles.cardButton}>
        Open
      </Link>
    </article>
  );
}

function RoadmapItem({
  number,
  title,
  complete = false,
}: {
  number: string;
  title: string;
  complete?: boolean;
}) {
  return (
    <div
      style={{
        ...styles.roadmapItem,
        ...(complete ? styles.roadmapComplete : {}),
      }}
    >
      <strong>{number}</strong>

      <span>{title}</span>

      {complete && (
        <small>COMPLETE</small>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 50% -10%, rgba(255,106,0,0.14), transparent 35%), #050505",
    color: "#fff",
    padding: "40px 24px 80px",
  },

  shell: {
    width: "min(1180px, 100%)",
    margin: "0 auto",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    marginBottom: "30px",
    flexWrap: "wrap",
  },

  headerActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },

  eyebrow: {
    margin: "0 0 8px",
    color: "#ff6a00",
    fontSize: "12px",
    fontWeight: 900,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
  },

  title: {
    margin: 0,
    fontSize: "clamp(2.3rem, 5vw, 4.2rem)",
    lineHeight: 0.98,
    letterSpacing: "-0.06em",
    fontWeight: 950,
  },

  subtitle: {
    color: "#8d8d8d",
    margin: "14px 0 0",
    fontSize: "15px",
  },

  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "44px",
    padding: "0 15px",
    borderRadius: "9px",
    border: "1px solid #303030",
    background: "#151515",
    color: "#fff",
    textDecoration: "none",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
  },

  errorBox: {
    background: "rgba(255,60,60,0.08)",
    border: "1px solid rgba(255,60,60,0.35)",
    color: "#ff8585",
    borderRadius: "10px",
    padding: "13px 15px",
    marginBottom: "20px",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "16px",
    marginBottom: "22px",
  },

  statCard: {
    background: "#111",
    border: "1px solid #252525",
    borderRadius: "14px",
    padding: "19px",
  },

  statLabel: {
    display: "block",
    color: "#858585",
    fontSize: "11px",
    fontWeight: 900,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    marginBottom: "14px",
  },

  statValue: {
    fontSize: "2.5rem",
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "-0.06em",
  },

  panel: {
    background: "rgba(17,17,17,0.94)",
    border: "1px solid #252525",
    borderRadius: "16px",
    padding: "24px",
    marginBottom: "20px",
  },

  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    marginBottom: "22px",
    flexWrap: "wrap",
  },

  sectionEyebrow: {
    margin: "0 0 7px",
    color: "#ff6a00",
    fontSize: "10px",
    fontWeight: 900,
    letterSpacing: "0.14em",
  },

  panelTitle: {
    margin: 0,
    fontSize: "1.45rem",
    fontWeight: 950,
  },

  panelText: {
    color: "#888",
    maxWidth: "700px",
    lineHeight: 1.6,
    margin: "8px 0 0",
  },

  badge: {
    borderRadius: "999px",
    padding: "7px 11px",
    background: "rgba(255,106,0,0.1)",
    border: "1px solid rgba(255,106,0,0.3)",
    color: "#ffad72",
    fontSize: "10px",
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },

  cardGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "15px",
  },

  card: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    background: "#0c0c0c",
    border: "1px solid #282828",
    borderRadius: "13px",
    padding: "18px",
    minHeight: "190px",
  },

  cardNumber: {
    color: "#555",
    fontSize: "11px",
    fontWeight: 900,
    letterSpacing: "0.1em",
  },

  cardTitle: {
    margin: 0,
    fontSize: "1.15rem",
    fontWeight: 950,
  },

  cardText: {
    margin: 0,
    color: "#999",
    lineHeight: 1.55,
    flex: 1,
    fontSize: "13px",
  },

  cardButton: {
    alignSelf: "flex-start",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "38px",
    padding: "0 13px",
    borderRadius: "8px",
    background: "#ff6a00",
    color: "#050505",
    textDecoration: "none",
    fontSize: "11px",
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  roadmap: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "10px",
  },

  roadmapItem: {
    display: "flex",
    flexDirection: "column",
    gap: "7px",
    background: "#0b0b0b",
    border: "1px solid #252525",
    borderRadius: "11px",
    padding: "15px",
  },

  roadmapComplete: {
    borderColor: "rgba(255,106,0,0.35)",
    background: "rgba(255,106,0,0.04)",
  },

  loader: {
    minHeight: "60vh",
    display: "grid",
    placeItems: "center",
    color: "#aaa",
  },
};
