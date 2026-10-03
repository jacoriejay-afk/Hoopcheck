"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

type AdminRole = {
  role: string;
};

type Coach = {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
  current_team_id: string | null;
  website: string | null;
  photo_url: string | null;
  source: string | null;
  source_id: string | null;
  last_synced_at: string | null;
  active: boolean;
};

type Team = {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
  league_id: string | null;
  league_name: string | null;
};

type League = {
  id: string;
  name: string;
  country: string | null;
  level: string | null;
};

type DirectorySource = {
  id: string;
  name: string;
};

export default function AdminCoachDirectoryPage() {
  const router = useRouter();

  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [sources, setSources] = useState<DirectorySource[]>([]);

  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadDirectory() {
      setLoading(true);
      setError("");

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (sessionError || !session?.user) {
        router.replace("/login");
        return;
      }

      const { data: adminRole, error: roleError } = await supabase
        .from("admin_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!mounted) return;

      if (roleError || !adminRole) {
        router.replace("/dashboard");
        return;
      }

      const normalizedRole = String(
        (adminRole as AdminRole).role
      )
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
        coachesResult,
        teamsResult,
        leaguesResult,
        sourcesResult,
      ] = await Promise.all([
        supabase
          .from("coaches")
          .select(
            `
              id,
              name,
              country,
              city,
              current_team_id,
              website,
              photo_url,
              source,
              source_id,
              last_synced_at,
              active
            `
          )
          .order("name"),

        supabase
          .from("teams")
          .select(
            `
              id,
              name,
              country,
              city,
              league_id,
              league_name
            `
          )
          .order("name"),

        supabase
          .from("leagues")
          .select(
            `
              id,
              name,
              country,
              level
            `
          )
          .order("name"),

        supabase
          .from("directory_sources")
          .select("id, name")
          .order("name"),
      ]);

      if (!mounted) return;

      const firstError =
        coachesResult.error ??
        teamsResult.error ??
        leaguesResult.error ??
        sourcesResult.error;

      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      setCoaches((coachesResult.data ?? []) as Coach[]);
      setTeams((teamsResult.data ?? []) as Team[]);
      setLeagues((leaguesResult.data ?? []) as League[]);
      setSources((sourcesResult.data ?? []) as DirectorySource[]);
      setRole(normalizedRole);
      setLoading(false);
    }

    void loadDirectory();

    return () => {
      mounted = false;
    };
  }, [router]);

  const teamMap = useMemo(() => {
    return new Map(teams.map((team) => [team.id, team]));
  }, [teams]);

  const leagueMap = useMemo(() => {
    return new Map(
      leagues.map((league) => [league.id, league])
    );
  }, [leagues]);

  const sourceMap = useMemo(() => {
    return new Map(
      sources.map((source) => [source.id, source.name])
    );
  }, [sources]);

  const filteredCoaches = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return coaches.filter((coach) => {
      if (!showInactive && !coach.active) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const team = coach.current_team_id
        ? teamMap.get(coach.current_team_id)
        : undefined;

      const league = team?.league_id
        ? leagueMap.get(team.league_id)
        : undefined;

      const sourceName = coach.source_id
        ? sourceMap.get(coach.source_id)
        : coach.source;

      const searchableText = [
        coach.name,
        coach.country,
        coach.city,
        team?.name,
        team?.country,
        team?.city,
        team?.league_name,
        league?.name,
        league?.country,
        sourceName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [
    coaches,
    search,
    showInactive,
    teamMap,
    leagueMap,
    sourceMap,
  ]);

  const activeCount = coaches.filter(
    (coach) => coach.active
  ).length;

  const inactiveCount = coaches.filter(
    (coach) => !coach.active
  ).length;

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.loader}>
          Loading coach directory...
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
              Coach Directory
            </h1>

            <p style={styles.subtitle}>
              Search and review coaches across the
              worldwide basketball directory.
            </p>
          </div>

          <div style={styles.headerActions}>
            <Link
              href="/admin/directory"
              style={styles.secondaryButton}
            >
              ← Directory
            </Link>

            <Link
              href="/admin/reviews"
              style={styles.secondaryButton}
            >
              Review Queue
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
            label="Total Coaches"
            value={coaches.length}
          />

          <StatCard
            label="Active"
            value={activeCount}
          />

          <StatCard
            label="Inactive"
            value={inactiveCount}
          />

          <StatCard
            label="Showing"
            value={filteredCoaches.length}
          />
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <p style={styles.sectionEyebrow}>
                COACH DATABASE
              </p>

              <h2 style={styles.panelTitle}>
                Find a coach
              </h2>
            </div>

            <span style={styles.badge}>
              {role === "admin"
                ? "Admin Access"
                : "Moderator Access"}
            </span>
          </div>

          <div style={styles.controls}>
            <div style={styles.searchWrapper}>
              <span style={styles.searchIcon}>
                🔎
              </span>

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search coach, team, league, city, or country..."
                style={styles.searchInput}
              />
            </div>

            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event) =>
                  setShowInactive(event.target.checked)
                }
              />

              <span>
                Show inactive
              </span>
            </label>
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.resultsHeader}>
            <div>
              <p style={styles.sectionEyebrow}>
                RESULTS
              </p>

              <h2 style={styles.panelTitle}>
                {filteredCoaches.length.toLocaleString()}{" "}
                coaches
              </h2>
            </div>

            <span style={styles.resultNote}>
              {teams.length.toLocaleString()} teams ·{" "}
              {leagues.length.toLocaleString()} leagues
            </span>
          </div>

          {filteredCoaches.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>
                🏀
              </div>

              <h3 style={styles.emptyTitle}>
                No coaches found
              </h3>

              <p style={styles.emptyText}>
                {coaches.length === 0
                  ? "The coach directory does not contain any records yet."
                  : "Try another search or enable inactive coaches."}
              </p>
            </div>
          ) : (
            <div style={styles.coachGrid}>
              {filteredCoaches.map((coach) => {
                const team = coach.current_team_id
                  ? teamMap.get(coach.current_team_id)
                  : undefined;

                const league = team?.league_id
                  ? leagueMap.get(team.league_id)
                  : undefined;

                const sourceName = coach.source_id
                  ? sourceMap.get(coach.source_id)
                  : coach.source;

                return (
                  <article
                    key={coach.id}
                    style={{
                      ...styles.coachCard,
                      ...(coach.active
                        ? {}
                        : styles.inactiveCard),
                    }}
                  >
                    <div style={styles.coachTop}>
                      <div style={styles.avatar}>
                        {coach.photo_url ? (
                          <img
                            src={coach.photo_url}
                            alt={coach.name}
                            style={styles.avatarImage}
                          />
                        ) : (
                          getInitials(coach.name)
                        )}
                      </div>

                      <div style={styles.statusColumn}>
                        <span
                          style={{
                            ...styles.status,
                            ...(coach.active
                              ? styles.activeStatus
                              : styles.inactiveStatus),
                          }}
                        >
                          {coach.active
                            ? "ACTIVE"
                            : "INACTIVE"}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3 style={styles.coachName}>
                        {coach.name}
                      </h3>

                      <p style={styles.location}>
                        {formatLocation(
                          coach.city,
                          coach.country
                        )}
                      </p>
                    </div>

                    <div style={styles.relationships}>
                      <InfoRow
                        label="Current Team"
                        value={
                          team?.name ??
                          "No team connected"
                        }
                      />

                      <InfoRow
                        label="League"
                        value={
                          league?.name ??
                          team?.league_name ??
                          "No league connected"
                        }
                      />

                      <InfoRow
                        label="Source"
                        value={
                          sourceName ??
                          "Manual / Unknown"
                        }
                      />
                    </div>

                    <div style={styles.cardFooter}>
                      <Link
                        href={`/coaches/${coach.id}`}
                        style={styles.primaryButton}
                      >
                        View Profile
                      </Link>

                      {coach.website && (
                        <a
                          href={coach.website}
                          target="_blank"
                          rel="noreferrer"
                          style={styles.secondarySmallButton}
                        >
                          Website ↗
                        </a>
                      )}
                    </div>

                    {coach.last_synced_at && (
                      <p style={styles.synced}>
                        Last synced{" "}
                        {formatDate(
                          coach.last_synced_at
                        )}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <p style={styles.sectionEyebrow}>
                DIRECTORY STRUCTURE
              </p>

              <h2 style={styles.panelTitle}>
                Coach → Team → League
              </h2>

              <p style={styles.panelText}>
                Each coach can be connected to a current
                team, and each team can be connected to
                a league. This structure keeps the
                worldwide directory searchable and
                organized.
              </p>
            </div>
          </div>

          <div style={styles.structureGrid}>
            <StructureCard
              number="01"
              title="Coach"
              description="Name, location, profile, source, and current team."
            />

            <StructureCard
              number="02"
              title="Team"
              description="Professional team, location, logo, and league relationship."
            />

            <StructureCard
              number="03"
              title="League"
              description="Competition name, country, level, season, and source."
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
}: {
  label: string;
  value: number;
}) {
  return (
    <div style={styles.statCard}>
      <span style={styles.statLabel}>
        {label}
      </span>

      <strong style={styles.statValue}>
        {value.toLocaleString()}
      </strong>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>
        {label}
      </span>

      <span style={styles.infoValue}>
        {value}
      </span>
    </div>
  );
}

function StructureCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div style={styles.structureCard}>
      <span style={styles.structureNumber}>
        {number}
      </span>

      <h3 style={styles.structureTitle}>
        {title}
      </h3>

      <p style={styles.structureText}>
        {description}
      </p>
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatLocation(
  city: string | null,
  country: string | null
) {
  if (city && country) {
    return `${city}, ${country}`;
  }

  return city || country || "Location not listed";
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "unknown date";
  }

  return date.toLocaleDateString();
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 50% -10%, rgba(255,106,0,0.14), transparent 35%), #050505",
    color: "#fff",
    padding: "40px 20px 80px",
  },

  shell: {
    width: "min(1200px, 100%)",
    margin: "0 auto",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    marginBottom: "28px",
    flexWrap: "wrap",
  },

  headerActions: {
    display: "flex",
    gap: "9px",
    flexWrap: "wrap",
  },

  eyebrow: {
    margin: "0 0 8px",
    color: "#ff6a00",
    fontSize: "11px",
    fontWeight: 950,
    letterSpacing: "0.17em",
    textTransform: "uppercase",
  },

  title: {
    margin: 0,
    fontSize: "clamp(2.3rem, 5vw, 4rem)",
    lineHeight: 0.98,
    letterSpacing: "-0.06em",
    fontWeight: 950,
  },

  subtitle: {
    color: "#8c8c8c",
    margin: "13px 0 0",
    maxWidth: "650px",
    lineHeight: 1.5,
  },

  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "42px",
    padding: "0 14px",
    borderRadius: "8px",
    background: "#151515",
    border: "1px solid #303030",
    color: "#fff",
    textDecoration: "none",
    fontSize: "11px",
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
  },

  errorBox: {
    background: "rgba(255,50,50,0.08)",
    border: "1px solid rgba(255,70,70,0.35)",
    color: "#ff8b8b",
    borderRadius: "10px",
    padding: "13px 15px",
    marginBottom: "18px",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "14px",
    marginBottom: "20px",
  },

  statCard: {
    background: "#111",
    border: "1px solid #272727",
    borderTop: "3px solid #ff6a00",
    borderRadius: "13px",
    padding: "18px",
  },

  statLabel: {
    display: "block",
    color: "#7f7f7f",
    fontSize: "10px",
    fontWeight: 900,
    letterSpacing: "0.11em",
    textTransform: "uppercase",
    marginBottom: "13px",
  },

  statValue: {
    display: "block",
    fontSize: "2.25rem",
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "-0.05em",
  },

  panel: {
    background: "rgba(17,17,17,0.95)",
    border: "1px solid #252525",
    borderRadius: "15px",
    padding: "22px",
    marginBottom: "18px",
  },

  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "18px",
    flexWrap: "wrap",
    marginBottom: "20px",
  },

  sectionEyebrow: {
    margin: "0 0 6px",
    color: "#ff6a00",
    fontSize: "9px",
    fontWeight: 950,
    letterSpacing: "0.16em",
  },

  panelTitle: {
    margin: 0,
    fontSize: "1.4rem",
    fontWeight: 950,
    letterSpacing: "-0.02em",
  },

  panelText: {
    margin: "8px 0 0",
    color: "#858585",
    maxWidth: "750px",
    lineHeight: 1.6,
  },

  badge: {
    borderRadius: "999px",
    padding: "6px 10px",
    background: "rgba(255,106,0,0.1)",
    border: "1px solid rgba(255,106,0,0.3)",
    color: "#ffad72",
    fontSize: "9px",
    fontWeight: 950,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },

  controls: {
    display: "flex",
    alignItems: "center",
    gap: "15px",
    flexWrap: "wrap",
  },

  searchWrapper: {
    position: "relative",
    flex: "1 1 400px",
  },

  searchIcon: {
    position: "absolute",
    left: "14px",
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: "14px",
    opacity: 0.6,
  },

  searchInput: {
    width: "100%",
    minHeight: "48px",
    boxSizing: "border-box",
    padding: "0 15px 0 43px",
    borderRadius: "9px",
    border: "1px solid #303030",
    background: "#090909",
    color: "#fff",
    outline: "none",
    fontSize: "14px",
  },

  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#aaa",
    fontSize: "12px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  resultsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: "15px",
    marginBottom: "20px",
    flexWrap: "wrap",
  },

  resultNote: {
    color: "#686868",
    fontSize: "11px",
  },

  coachGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "14px",
  },

  coachCard: {
    background: "#0b0b0b",
    border: "1px solid #292929",
    borderRadius: "13px",
    padding: "17px",
    minWidth: 0,
  },

  inactiveCard: {
    opacity: 0.68,
    borderColor: "#333",
  },

  coachTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "14px",
  },

  avatar: {
    width: "54px",
    height: "54px",
    borderRadius: "50%",
    background:
      "linear-gradient(135deg, #ff6a00, #ffad72)",
    color: "#050505",
    display: "grid",
    placeItems: "center",
    fontSize: "17px",
    fontWeight: 950,
    overflow: "hidden",
  },

  avatarImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },

  statusColumn: {
    display: "flex",
    justifyContent: "flex-end",
  },

  status: {
    display: "inline-flex",
    borderRadius: "999px",
    padding: "5px 8px",
    fontSize: "8px",
    fontWeight: 950,
    letterSpacing: "0.08em",
  },

  activeStatus: {
    color: "#65df65",
    background: "rgba(70,210,70,0.1)",
    border: "1px solid rgba(70,210,70,0.2)",
  },

  inactiveStatus: {
    color: "#888",
    background: "#1b1b1b",
    border: "1px solid #292929",
  },

  coachName: {
    margin: 0,
    fontSize: "1.1rem",
    fontWeight: 950,
  },

  location: {
    margin: "5px 0 0",
    color: "#777",
    fontSize: "12px",
  },

  relationships: {
    marginTop: "16px",
    borderTop: "1px solid #222",
    borderBottom: "1px solid #222",
  },

  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    padding: "10px 0",
    borderBottom: "1px solid #1d1d1d",
  },

  infoLabel: {
    color: "#666",
    fontSize: "10px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    flexShrink: 0,
  },

  infoValue: {
    color: "#ddd",
    fontSize: "11px",
    fontWeight: 700,
    textAlign: "right",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  cardFooter: {
    display: "flex",
    gap: "8px",
    marginTop: "15px",
    flexWrap: "wrap",
  },

  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "36px",
    padding: "0 12px",
    borderRadius: "7px",
    background: "#ff6a00",
    color: "#050505",
    textDecoration: "none",
    fontSize: "10px",
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  secondarySmallButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "36px",
    padding: "0 12px",
    borderRadius: "7px",
    background: "#151515",
    border: "1px solid #303030",
    color: "#ddd",
    textDecoration: "none",
    fontSize: "10px",
    fontWeight: 900,
    textTransform: "uppercase",
  },

  synced: {
    margin: "11px 0 0",
    color: "#555",
    fontSize: "9px",
  },

  emptyState: {
    textAlign: "center",
    padding: "60px 20px",
    border: "1px dashed #292929",
    borderRadius: "12px",
    background: "#0b0b0b",
  },

  emptyIcon: {
    fontSize: "30px",
    marginBottom: "12px",
  },

  emptyTitle: {
    margin: 0,
    fontSize: "1.1rem",
  },

  emptyText: {
    color: "#777",
    margin: "8px auto 0",
    maxWidth: "500px",
    lineHeight: 1.5,
    fontSize: "13px",
  },

  structureGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
  },

  structureCard: {
    background: "#0b0b0b",
    border: "1px solid #272727",
    borderRadius: "11px",
    padding: "16px",
  },

  structureNumber: {
    color: "#ff6a00",
    fontSize: "10px",
    fontWeight: 950,
  },

  structureTitle: {
    margin: "10px 0 7px",
    fontSize: "1rem",
    fontWeight: 950,
  },

  structureText: {
    margin: 0,
    color: "#777",
    lineHeight: 1.5,
    fontSize: "12px",
  },

  loader: {
    minHeight: "60vh",
    display: "grid",
    placeItems: "center",
    color: "#aaa",
  },
};
