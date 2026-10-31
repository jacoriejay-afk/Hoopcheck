"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import Logo from "../../../components/Logo";
import { useLanguage } from "../../../components/LanguageProvider";

type DirectoryCounts = {
  coaches: number;
  teams: number;
  leagues: number;
};

export default function AdminDirectoryPage() {
  const { t } = useLanguage();
  const router = useRouter();

  const [hasAdminAccess, setHasAdminAccess] = useState(false);
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

      setHasAdminAccess(true);

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
      <main className="admin-directory-shell" style={styles.page}>
        <div style={styles.loader}>
          {t("loadingDirectoryControls")}
        </div>
      </main>
    );
  }

  return (
    <main className="admin-directory-shell" style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <div>
            <div className="admin-brand"><Logo variant="icon" size={34} /><p style={styles.eyebrow}>HOOPCHECK ADMIN</p></div>

            <h1 style={styles.title}>
              {t("adminControlCenter")}
            </h1>

            <p style={styles.subtitle}>
              {t("manageWorldwideDirectory")}
            </p>
          </div>

          <div style={styles.headerActions}>
            <Link href="/admin/reviews" className="admin-primary-action" style={styles.secondaryButton}>{t("reviewQueue")}</Link>
            <Link href="/admin/users?account_type=manager" style={styles.secondaryButton}>Team Managers</Link>

            <Link
              href="/dashboard"
              style={styles.secondaryButton}
            >
              {t("dashboard")}
            </Link>
          </div>
        </header>

        {error && (
          <div style={styles.errorBox}>
            {error}
          </div>
        )}

        <section className="admin-stats-grid" style={styles.statsGrid}>
          <StatCard
            label={t("activeCoaches")}
            value={counts.coaches}
            accent="#ff8a1f"
          />

          <StatCard
            label={t("activeTeams")}
            value={counts.teams}
            accent="#f5b36a"
          />

          <StatCard
            label={t("activeLeagues")}
            value={counts.leagues}
            accent="#ff6a00"
          />
        </section>

        <section className="admin-directory-panel" style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <p style={styles.sectionEyebrow}>
                {t("directoryManagement")}
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
              {hasAdminAccess
                ? "Admin / Moderator Access"
                : "Access"}
            </span>
          </div>

          <div style={styles.adminGroup}>
            <h3 style={styles.groupTitle}>People &amp; Access</h3>
            <div style={styles.cardGrid}>
              <DirectoryCard number="01" title="Users & Player Control" description="Search accounts, manage account types, verification, membership, and profile status." href="/admin/users" />
              <DirectoryCard number="02" title="Team Managers" description="Find and manage Team Manager accounts, review their account details, and confirm the correct team-representative role." href="/admin/users?account_type=manager" />
              <DirectoryCard number="03" title="Player Verification" description="Review professional-player verification requests and manage Verified Player badges." href="/admin/verification" />
            </div>
          </div>

          <div style={styles.adminGroup}>
            <h3 style={styles.groupTitle}>Community &amp; Moderation</h3>
            <div style={styles.cardGrid}>
              <DirectoryCard number="04" title="Review Queue" description="Review player-submitted team, coach, and league reviews." href="/admin/reviews" />
              <DirectoryCard number="05" title="Review Comments" description="Approve, reject, or flag player comments on review posts." href="/admin/comments" />
              <DirectoryCard number="06" title="Content Reports" description="Review reports across reviews, HoopFeed posts, and live-game chat." href="/admin/content-reports" />
              <DirectoryCard number="07" title="Profile Reports" description="Review profile reports and resolve or dismiss flags." href="/admin/reports" />
              <DirectoryCard number="08" title="Profile Claims" description="Review requests to claim team and professional profiles." href="/admin/claims" />
              <DirectoryCard number="09" title="Community Inbox" description="Handle member support, partnership, sponsor, and donation inquiries." href="/admin/support" />
              <DirectoryCard number="10" title="Team FanFeed" description="Review and manage team-focused fan community activity." href="/admin/team-fanfeed" />
            </div>
          </div>

          <div style={styles.adminGroup}>
            <h3 style={styles.groupTitle}>Basketball Directory</h3>
            <div style={styles.cardGrid}>
              <DirectoryCard number="11" title="Coaches" description="Manage coach profiles, teams, countries, sources, and active status." href="/admin/directory/manage?kind=coaches" />
              <DirectoryCard number="12" title="Teams" description="Manage professional teams and connect each team to its league." href="/admin/directory/manage?kind=teams" />
              <DirectoryCard number="13" title="Leagues" description="Manage leagues, countries, seasons, and competition levels." href="/admin/directory/manage?kind=leagues" />
              <DirectoryCard number="14" title="Team Logo Studio" description="Manage team logos and directory visual assets." href="/admin/team-logos" />
              <DirectoryCard number="15" title="Data Providers" description="Manage licensed providers, sync status, source documentation, and import history." href="/admin/directory/providers" />
            </div>
          </div>

          <div style={styles.adminGroup}>
            <h3 style={styles.groupTitle}>Data Rights &amp; Coverage</h3>
            <div style={styles.cardGrid}>
              <DirectoryCard number="16" title="Rights & Coverage" description="Track country and league rights, commercial use, redistribution, evidence, and production approval." href="/admin/rights" />
              <DirectoryCard number="17" title="Licensed Provider Gate" description="Track research-only providers until written commercial/API permission is verified. No scraping or unlicensed redistribution is enabled." href="/admin/directory/providers" />
            </div>
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

            <RoadmapItem number="08" title="Bulk CSV imports" complete />

            <RoadmapItem number="09" title="Licensed worldwide imports" />

            <RoadmapItem number="10" title="Provider sync center" complete />

            <RoadmapItem number="11" title="Rights & Coverage Center" complete />
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
        Open →
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
    background: "#F7F7F5",
    color: "#111111",
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
    color: "#C2410C",
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
    color: "#525252",
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
    border: "1px solid #D8D8D4",
    background: "#FFFFFF",
    color: "#111111",
    textDecoration: "none",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
  },

  errorBox: {
    background: "rgba(255,60,60,0.08)",
    border: "1px solid rgba(255,60,60,0.35)",
    color: "#B42318",
    borderRadius: "10px",
    padding: "13px 15px",
    marginBottom: "20px",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "16px",
    marginBottom: "22px",
  },

  statCard: {
    background: "#FFFFFF",
    border: "1px solid #E2E2DE",
    borderRadius: "14px",
    padding: "19px",
  },

  statLabel: {
    display: "block",
    color: "#525252",
    fontSize: "11px",
    fontWeight: 900,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    marginBottom: "14px",
  },

  statValue: {
    fontSize: "2.5rem",
    color: "#C2410C",
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "-0.06em",
  },

  panel: {
    background: "#FFFFFF",
    border: "1px solid #E2E2DE",
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
    color: "#C2410C",
    fontSize: "10px",
    fontWeight: 900,
    letterSpacing: "0.14em",
  },

  panelTitle: {
    margin: 0,
    fontSize: "1.45rem",
    color: "#111111",
    fontWeight: 950,
  },

  panelText: {
    color: "#525252",
    maxWidth: "700px",
    lineHeight: 1.6,
    margin: "8px 0 0",
  },

  badge: {
    borderRadius: "999px",
    padding: "7px 11px",
    background: "rgba(255,106,0,0.1)",
    border: "1px solid rgba(255,106,0,0.3)",
    color: "#9A3412",
    fontSize: "10px",
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },

  adminGroup: { marginTop: "24px" },

  groupTitle: { margin: "0 0 12px", color: "#73736E", fontSize: "11px", fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" },

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
    background: "#FFFFFF",
    border: "1px solid #E2E2DE",
    borderRadius: "13px",
    padding: "18px",
    minHeight: "0",
  },

  cardNumber: {
    color: "#6B6B66",
    fontSize: "11px",
    fontWeight: 900,
    letterSpacing: "0.1em",
  },

  cardTitle: {
    margin: 0,
    fontSize: "1.15rem",
    color: "#111111",
    fontWeight: 950,
  },

  cardText: {
    margin: 0,
    color: "#525252",
    lineHeight: 1.55,
    flex: 1,
    fontSize: "13px",
  },

  cardButton: {
    alignSelf: "flex-start",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "34px",
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
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "10px",
  },

  roadmapItem: {
    display: "flex",
    flexDirection: "column",
    gap: "7px",
    background: "#FFFFFF",
    border: "1px solid #E2E2DE",
    borderRadius: "11px",
    padding: "15px",
  },

  roadmapComplete: {
    borderColor: "rgba(255,106,0,0.35)",
    background: "#FFF7F3",
  },

  loader: {
    minHeight: "60vh",
    display: "grid",
    placeItems: "center",
    color: "#525252",
  },
};
