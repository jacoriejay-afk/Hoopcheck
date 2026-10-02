“use client”;

import {
useEffect,
useState,
} from “react”;
import Link from “next/link”;
import { supabase } from “../../lib/supabase”;

type League = {
id: string;
name: string;
country: string | null;
level: string | null;
};

export default function LeaguesPage() {
const [leagues, setLeagues] = useState<League[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
async function loadLeagues() {
const { data, error } = await supabase
.from(“leagues”)
.select(“id, name, country, level”)
.order(“name”);

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
HoopCheck
    <div className="links">
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
      leagues.map((league) => (
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
  <style jsx>{`
    .search-nav {
      color: var(--orange);
      font-weight: 900;
    }
    .research-search {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      padding: 12px 18px;
      border: 2px solid var(--orange);
      border-radius: 999px;
      color: var(--orange);
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      transition: 0.2s ease;
    }
    .research-search:hover {
      background: var(--orange);
      color: #000;
    }
    .search-label {
      color: var(--orange);
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .search-button {
      white-space: nowrap;
    }
    @media (max-width: 700px) {
      .links {
        gap: 10px;
      }
      .links a {
        font-size: 12px;
      }
      .links .btn {
        padding: 9px 12px;
      }
      .actions {
        flex-direction: column;
        align-items: stretch;
      }
      .actions .btn {
        width: 100%;
        text-align: center;
      }
    }
  `}</style>
</main>

);
}

Save the file and commit it to GitHub. **Do not deploy to Vercel yet.**
