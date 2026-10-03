"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Coach = {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
  external_id: string | null;
  website: string | null;
  photo_url: string | null;
  source: string | null;
  last_synced_at: string | null;
  active: boolean;
  current_team_id: string | null;
};

type Team = {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
  league_name: string | null;
  league_id: string | null;
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

type AdminRole = {
  role: string;
};

export default function AdminCoachDirectoryPage() {
  const router = useRouter();

  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [sources, setSources] = useState<DirectorySource[]>([]);

  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  async function loadDirectory() {
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
            external_id,
            website,
            photo_url,
            source,
            last_synced_at,
            active,
            current_team_id
          `
        )
        .order("name", { ascending: true }),

      supabase
        .from("teams")
        .select(
          `
            id,
            name,
            country,
            city,
            league_name,
            league_id
          `
        )
        .order("name", { ascending: true }),

      supabase
        .from("leagues")
        .select("id, name, country, level")
        .order("name", { ascending: true }),

      supabase
        .from("directory_sources")
        .select("id, name")
        .eq("active", true)
        .order("name", { ascending: true }),
    ]);

    if (coachesResult.error) {
      console.error("Error loading coaches:", coachesResult.error);
    }

    if (teamsResult.error) {
      console.error("Error loading teams:", teamsResult.error);
    }

    if (leaguesResult.error) {
      console.error("Error loading leagues:", leaguesResult.error);
    }

    if (sourcesResult.error) {
      console.error("Error loading directory sources:", sourcesResult.error);
    }

    setCoaches((coachesResult.data ?? []) as Coach[]);
    setTeams((teamsResult.data ?? []) as Team[]);
    setLeagues((leaguesResult.data ?? []) as League[]);
    setSources((sourcesResult.data ?? []) as DirectorySource[]);
  }

  useEffect(() => {
    let mounted = true;

    async function loadAdminPage(userId: string) {
      const { data: adminRole, error: roleError } = await supabase
        .from("admin_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (!mounted) return;

      if (roleError || !adminRole) {
        router.replace("/dashboard");
        return;
      }

      const typedRole = adminRole as AdminRole;

      const normalizedRole = String(typedRole.role)
        .trim()
        .toLowerCase();

      if (
        normalizedRole !== "admin" &&
        normalizedRole !== "moderator"
      ) {
        router.replace("/dashboard");
        return;
      }

      setRole(normalizedRole);

      await loadDirectory();

      if (mounted) {
        setLoading(false);
      }
    }

    async function initializeAdminPage() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (session?.user) {
        await loadAdminPage(session.user.id);
      }
    }

    initializeAdminPage();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;

        if (!session?.user) {
          setLoading(false);
          router.replace("/login");
          return;
        }

        await loadAdminPage(session.user.id);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  async function runCoachAction(
    coachId: string,
    active: boolean
  ) {
    setActionLoading(coachId);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        "directory-admin",
        {
          body: {
            action: "set_active",
            coach_id: coachId,
            active,
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (error) {
        console.error("Directory admin error:", error);
        alert(error.message || "Unable to update coach.");
        return;
      }

      if (!data?.coach) {
        alert("The coach update did not return updated data.");
        return;
      }

      const updatedCoach = data.coach as Coach;

      setCoaches((current) =>
        current.map((coach) =>
          coach.id === updatedCoach.id
            ? updatedCoach
            : coach
        )
      );
    } catch (error) {
      console.error("Coach action failed:", error);
      alert("Something went wrong while updating the coach.");
    } finally {
      setActionLoading(null);
    }
  }

  const teamById = useMemo(() => {
    const map = new Map<string, Team>();

    teams.forEach((team) => {
      map.set(team.id, team);
    });

    return map;
  }, [teams]);

  const leagueById = useMemo(() => {
    const map = new Map<string, League>();

    leagues.forEach((league) => {
      map.set(league.id, league);
    });

    return map;
  }, [leagues]);

  const sourceById = useMemo(() => {
    const map = new Map<string, DirectorySource>();

    sources.forEach((source) => {
      map.set(source.id, source);
    });

    return map;
  }, [sources]);

  const filteredCoaches = useMemo(() => {
    const query = search.trim().toLowerCase();

    return coaches.filter((coach) => {
      if (!showInactive && !coach.active) {
        return false;
      }

      if (!query) {
        return true;
      }

      const team = coach.current_team_id
        ? teamById.get(coach.current_team_id)
        : undefined;

      const league = team?.league_id
        ? leagueById.get(team.league_id)
        : undefined;

      const searchableText = [
        coach.name,
        coach.country,
        coach.city,
        coach.external_id,
        coach.source,
        team?.name,
        team?.country,
        team?.city,
        team?.league_name,
        league?.name,
        league?.country,
        league?.level,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [
    coaches,
    search,
    showInactive,
    teamById,
    leagueById,
  ]);

  const activeCount = coaches.filter(
    (coach) => coach.active
  ).length;

  const inactiveCount = coaches.filter(
    (coach) => !coach.active
  ).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-12 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-white/60">
            Loading coach directory...
          </p>
        </div>
      </main>
    );
  }

  if (!role) {
    return null;
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <Link
            href="/admin/directory"
            className="mb-4 inline-flex text-sm text-orange-400 transition hover:text-orange-300"
          >
            ← Back to Directory Control Center
          </Link>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-orange-500">
                HoopCheck Admin
              </p>

              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Coach Directory
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
                Manage coaches imported into the worldwide
                HoopCheck directory.
              </p>
            </div>

            <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 px-5 py-4">
              <p className="text-xs uppercase tracking-wider text-orange-300">
                Access
              </p>
              <p className="mt-1 font-semibold capitalize text-white">
                {role}
              </p>
            </div>
          </div>
        </div>

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-white/50">
              Total coaches
            </p>
            <p className="mt-2 text-3xl font-bold">
              {coaches.length}
            </p>
          </div>

          <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-5">
            <p className="text-sm text-green-300/70">
              Active
            </p>
            <p className="mt-2 text-3xl font-bold text-green-300">
              {activeCount}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-white/50">
              Inactive
            </p>
            <p className="mt-2 text-3xl font-bold">
              {inactiveCount}
            </p>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="flex-1">
              <label
                htmlFor="coach-search"
                className="mb-2 block text-sm font-medium text-white/70"
              >
                Search coaches
              </label>

              <input
                id="coach-search"
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Coach, team, league, city, country, source..."
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-orange-500"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-3 text-sm text-white/70">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event) =>
                  setShowInactive(event.target.checked)
                }
                className="h-4 w-4 accent-orange-500"
              />
              Show inactive
            </label>
          </div>
        </section>

        <section className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              Coaches
            </h2>
            <p className="mt-1 text-sm text-white/50">
              Showing {filteredCoaches.length} coach
              {filteredCoaches.length === 1 ? "" : "es"}.
            </p>
          </div>
        </section>

        {filteredCoaches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-10 text-center">
            <h3 className="text-lg font-semibold">
              No coaches found
            </h3>

            <p className="mt-2 text-sm text-white/50">
              Try a different search or enable inactive
              coaches.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredCoaches.map((coach) => {
              const team = coach.current_team_id
                ? teamById.get(coach.current_team_id)
                : undefined;

              const league = team?.league_id
                ? leagueById.get(team.league_id)
                : undefined;

              const sourceName = coach.source
                ? coach.source
                : "Manual / Unknown";

              const isSaving =
                actionLoading === coach.id;

              return (
                <article
                  key={coach.id}
                  className={`overflow-hidden rounded-2xl border bg-white/[0.04] ${
                    coach.active
                      ? "border-white/10"
                      : "border-red-500/20 opacity-80"
                  }`}
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-4">
                        {coach.photo_url ? (
                          <img
                            src={coach.photo_url}
                            alt={coach.name}
                            className="h-14 w-14 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-lg font-bold text-orange-400">
                            {coach.name
                              .slice(0, 1)
                              .toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-bold">
                            {coach.name}
                          </h3>

                          <p className="mt-1 text-sm text-white/50">
                            {coach.city ||
                            coach.country
                              ? [
                                  coach.city,
                                  coach.country,
                                ]
                                  .filter(Boolean)
                                  .join(", ")
                              : "Location not listed"}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                          coach.active
                            ? "bg-green-500/15 text-green-300"
                            : "bg-red-500/15 text-red-300"
                        }`}
                      >
                        {coach.active
                          ? "ACTIVE"
                          : "INACTIVE"}
                      </span>
                    </div>

                    <div className="mt-5 space-y-3">
                      <div className="rounded-xl border border-white/5 bg-black/30 p-3">
                        <p className="text-xs uppercase tracking-wider text-white/30">
                          Team
                        </p>

                        <p className="mt-1 text-sm font-medium">
                          {team?.name ||
                            "No current team linked"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/5 bg-black/30 p-3">
                        <p className="text-xs uppercase tracking-wider text-white/30">
                          League
                        </p>

                        <p className="mt-1 text-sm font-medium">
                          {league?.name ||
                            team?.league_name ||
                            "No league linked"}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-white/5 bg-black/30 p-3">
                          <p className="text-xs uppercase tracking-wider text-white/30">
                            Source
                          </p>

                          <p className="mt-1 truncate text-sm">
                            {sourceName}
                          </p>
                        </div>

                        <div className="rounded-xl border border-white/5 bg-black/30 p-3">
                          <p className="text-xs uppercase tracking-wider text-white/30">
                            External ID
                          </p>

                          <p className="mt-1 truncate text-sm">
                            {coach.external_id ||
                              "Not set"}
                          </p>
                        </div>
                      </div>

                      {coach.source &&
                        sourceById.size > 0 && (
                          <p className="text-xs text-white/30">
                            Directory source:
                            {" "}
                            {sourceById.get(
                              coach.source
                            )?.name ||
                              coach.source}
                          </p>
                        )}

                      {coach.last_synced_at && (
                        <p className="text-xs text-white/30">
                          Last synced:{" "}
                          {new Date(
                            coach.last_synced_at
                          ).toLocaleString()}
                        </p>
                      )}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Link
                        href={`/coaches/${coach.id}`}
                        className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-orange-400"
                      >
                        View Profile
                      </Link>

                      {coach.website && (
                        <a
                          href={coach.website}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/5"
                        >
                          Website
                        </a>
                      )}

                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() =>
                          runCoachAction(
                            coach.id,
                            !coach.active
                          )
                        }
                        className={`rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          coach.active
                            ? "border-red-500/30 text-red-300 hover:bg-red-500/10"
                            : "border-green-500/30 text-green-300 hover:bg-green-500/10"
                        }`}
                      >
                        {isSaving
                          ? "Saving..."
                          : coach.active
                          ? "Deactivate"
                          : "Activate"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
