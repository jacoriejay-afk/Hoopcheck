"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DirectoryLayout from "../../components/DirectoryLayout";
import { supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import FollowButton from "../../components/FollowButton";
import SearchBar from "../../components/SearchBar";
import { VerifiedBadge } from "../../components/HoopCheckUI";

type Player = {
  id: string;
  display_name: string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  country: string | null;
  current_country: string | null;
  current_team: string | null;
  position: string | null;
  years_pro: number | null;
  player_verified: boolean;
  avatar_url: string | null;
  basketball_type: string | null;
  free_agent: boolean;
};

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const size = 24;

  const withTimeout = <T,>(promise: PromiseLike<T>, ms = 8000, fallback?: T) =>
    Promise.race([
      Promise.resolve(promise),
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback as T), ms)),
    ]);

  useEffect(() => {
    let mounted = true;
    const username = query.trim();

    if (!username) {
      setPlayers([]);
      setHasMore(false);
      setSearchError("");
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setSearchError("");
        const escapedUsername = username.replace(/[\\%_]/g, "\\$&");
        let request = supabase
          .from("profiles")
          .select("id,display_name,username,first_name,last_name,country,current_country,current_team,position,years_pro,player_verified,avatar_url,basketball_type,free_agent")
          .eq("account_type", "player")
          .eq("profile_visibility", "public")
          .neq("moderation_status", "suspended")
          .not("username", "is", null)
          .ilike("username", `%${escapedUsername}%`)
          .order("username", { ascending: true });

        const escapedCountry = country.trim().replace(/[\\%_]/g, "\\$&");
        if (escapedCountry) request = request.ilike("current_country", `%${escapedCountry}%`);

        const [{ data, error }, { data: { user: viewer } }] = await Promise.all([
          withTimeout<any>(request.range(page * size, page * size + size - 1), 5000, { data: [], error: new Error("Search timed out") }),
          supabase.auth.getUser(),
        ]);
        const { data: blockedRows } = viewer ? await supabase.from("user_blocks").select("blocked_id").eq("blocker_id", viewer.id) : { data: [] as { blocked_id: string }[] };
        const blockedIds = new Set((blockedRows || []).map((row: any) => row.blocked_id));
        if (mounted) {
          setPlayers(error ? [] : ((data || []) as Player[]).filter(player => !blockedIds.has(player.id)));
          setSearchError(error ? "Search could not be completed. Please try again." : "");
          setHasMore(!error && (data?.length || 0) === size);
          setLoading(false);
        }
      })();
    }, 250);

    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [query, country, page, retryCount]);

  return (
    <main className="page-shell hc-player-directory-page">
      <div className="page-container">
        <DirectoryLayout current="players" />

        <section className="dashboard-card" style={{ marginTop: 18 }}>
          <div className="research-search">
            <div className="search-label">PLAYER SEARCH</div>
            <SearchBar value={query} onChange={(value) => { setQuery(value); setPage(0); }} onSubmit={(value) => { setQuery(value); setPage(0); }} placeholder="Search players, coaches, teams, or leagues" ariaLabel="Search by player username" />
            <div className="team-filter-row">
              <input
                value={country}
                onChange={(event) => {
                  setCountry(event.target.value);
                  setPage(0);
                }}
                placeholder="Optional country filter"
                aria-label="Filter matching players by country"
                autoComplete="country-name"
              />
              {(query || country) && <button type="button" className="btn dark" onClick={() => { setQuery(""); setCountry(""); setPage(0); }} aria-label="Clear player search">Clear search</button>}
            </div>
          </div>
        </section>

        {!query.trim() ? (
          <div className="dashboard-card" style={{ marginTop: 18 }}>
            <h2>Search by username</h2>
            <p className="muted">Player profiles stay hidden until you enter a username above.</p>
          </div>
        ) : loading ? (
          <div className="dashboard-card" style={{ marginTop: 18 }}>
            <HoopLoading label="Searching usernames..." />
          </div>
        ) : searchError ? (
          <div className="dashboard-card" style={{ marginTop: 18 }} role="alert">
            <h2>Search unavailable</h2>
            <p className="muted">{searchError}</p>
            <button className="btn dark" type="button" onClick={() => setRetryCount((current) => current + 1)}>Try again</button>
          </div>
        ) : (
          <>
          <div className="hc-player-result-count" role="status" aria-live="polite">{players.length ? `Showing ${players.length} player${players.length === 1 ? "" : "s"}` : "No matching players"}</div>
          <section className="grid hc-player-results" style={{ marginTop: 18 }}>
            {players.map((player) => {
              const name =
                player.display_name ||
                [player.first_name, player.last_name].filter(Boolean).join(" ") ||
                player.username ||
                "HoopCheck Player";

              return (
                <article className="dashboard-card" key={player.id}>
                  <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                    {player.avatar_url ? (
                      <img
                        src={player.avatar_url}
                        alt=""
                        style={{
                          width: 58,
                          height: 58,
                          borderRadius: "50%",
                          objectFit: "cover",
                          border: "1px solid var(--border)",
                        }}
                      />
                    ) : (
                      <div className="player-avatar-fallback">HC</div>
                    )}
                    <div>
                      <span className="card-kicker">PLAYER</span>
                      <h2>
                        {name}{" "}
                        {player.player_verified && (
                          <VerifiedBadge label="Verified professional player" />
                        )}
                      </h2>
                    </div>
                  </div>
                  <p className="muted">
                    {player.position || "Position not listed"} ·{" "}
                    {player.years_pro == null ? "Years pro not listed" : `${player.years_pro} years pro`}
                  </p>
                  <p>
                    {player.free_agent ? "🟠 Free Agent" : player.current_team || "Team not listed"}
                    {player.current_country ? ` · ${player.current_country}` : ""}
                  </p>
                  <div className="actions">
                    <FollowButton targetType="player" targetId={player.id} />
                    <Link href={`/players/${player.id}`} className="btn dark">View Profile</Link>
                  </div>
                </article>
              );
            })}
            {!players.length && (
              <div className="dashboard-card">
                <h2>No players found.</h2>
                <p className="muted">Try another username or adjust the country filter.</p>
              </div>
            )}
          </section>
          </>
        )}

        {query.trim() && !loading && !searchError && players.length > 0 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 12, padding: "20px 0 40px", flexWrap: "wrap" }}>
            <button className="btn dark" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>
              ← Previous
            </button>
            <span style={{ display: "inline-flex", alignItems: "center", color: "var(--page-muted)", padding: "0 8px" }}>
              Page {page + 1}
            </span>
            <button className="btn dark" disabled={!hasMore} onClick={() => setPage((current) => current + 1)}>
              Next →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
