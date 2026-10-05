"use client";

import {
useEffect,
useState,
} from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type League = {
id: string;
name: string;
country: string | null;
level: string | null;
season: string | null;
active: boolean;
};

export default function LeaguesPage() {
const [leagues, setLeagues] = useState<League[]>([]);
const [loading, setLoading] = useState(true);
const [country, setCountry] = useState("");

useEffect(() => {
async function loadLeagues() {
const { data, error } = await supabase
.from("leagues")
.select("id, name, country, level, season, active")
.eq("active", true)
.order("name");

  if (error) {
    console.error("Error loading leagues:", error);
    setLeagues([]);
  } else {
    setLeagues(data || []);
  }
  setLoading(false);
}
loadLeagues();

}, []);

return (
<main>
<nav className="nav">
  <Link href="/" className="logo">
    Hoop<span>Check</span>
  </Link>
    <div className="links">
          <button type="button" onClick={() => window.history.back()} style={{ background: "transparent", border: "1px solid #333", color: "#fff", borderRadius: 7, padding: "7px 10px", cursor: "pointer" }}>← Back</button>
      <Link href="/search" className="search-nav">
        Search
      </Link>
      <Link href="/dashboard">
        Dashboard
      </Link>
      <Link href="/membership" className="btn">
        Membership
      </Link>
    </div>
  </nav>
  <section className="hero">
    <div className="eyebrow">
      HoopCheck Leagues
    </div>
    <h1>
      Know the league
      <br />
      before you commit.
    </h1>
    <p>
      Explore professional basketball leagues and learn
      from players who have already experienced them.
    </p>
    <div className="actions">
      <Link href="/search" className="btn">
        Global Research Search
      </Link>
      <Link href="/coaches" className="btn dark">
        Research Coaches
      </Link>
      <Link href="/teams" className="btn dark">
        Research Teams
      </Link>
    </div>
  </section>
  <section className="hero" style={{ paddingTop: "25px", paddingBottom: "25px" }}><div style={{ maxWidth: 520 }}><label htmlFor="league-country" style={{ display: "block", fontWeight: 900, marginBottom: 8 }}>League country</label><select id="league-country" value={country} onChange={(e) => setCountry(e.target.value)} style={{ width: "100%" }}><option value="">All countries</option>{Array.from(new Set(leagues.map((league) => league.country).filter(Boolean) as string[])).sort().map((item) => <option key={item} value={item}>{item}</option>)}</select></div></section>
  <section className="grid">
    {loading ? (
      <div className="card">
        <div className="eyebrow">
          HoopCheck
        </div>
        <h2>
          Loading leagues...
        </h2>
        <p>
          Finding professional leagues in the
          HoopCheck database.
        </p>
      </div>
    ) : leagues.length === 0 ? (
      <div className="card">
        <div className="eyebrow">
          Coming Soon
        </div>
        <h2>
          No leagues yet
        </h2>
        <p>
          Leagues will appear here as HoopCheck&apos;s
          global basketball database grows.
        </p>
      </div>
    ) : (
      leagues.filter((league) => !country || league.country === country).map((league) => (
        <div
          className="card"
          key={league.id}
        >
          <div className="eyebrow">
            Professional League
          </div>
          <h2>
            {league.name}
          </h2>
          <p>
            {league.country || "Country not listed"}
          </p>
          <p style={{ color: "var(--orange)", fontWeight: 900 }}>Season: {league.season || "2026-27"}</p>
          {league.level && (
            <p>
              Level:{" "}
              <strong>
                {league.level}
              </strong>
            </p>
          )}
          <Link
            href={`/leagues/${league.id}`}
            className="btn"
          >
            View League
          </Link>
        </div>
      ))
    )}
  </section>
  <section className="hero">
    <div className="eyebrow">
      Player Intelligence
    </div>
    <h2>
      Every league
      <br />
      has a story.
    </h2>
    <p>
      Learn from the players who have already played
      there before deciding where your career goes next.
    </p>
    <div className="actions">
      <Link href="/signup" className="btn">
        Create Free Account
      </Link>
      <Link href="/membership" className="btn dark">
        Unlock Full Access
      </Link>
    </div>
  </section>
</main>

);
}
