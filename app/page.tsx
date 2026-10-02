import Link from "next/link";
export default function Home() {
  return (
    <main>
      <nav className="nav">
        <Link href="/" className="logo">
          Hoop<span>Check</span>
        </Link>
        <div className="links">
          <Link href="/login">Log in</Link>
          <Link href="/signup" className="btn">
            Sign Up
          </Link>
        </div>
      </nav>
      <section className="hero">
        <div className="eyebrow">Built for overseas basketball</div>
        <h1>
          Know who
          <br />
          you&apos;re
          <br />
          signing with.
        </h1>
        <p>
          Real player experiences. Real basketball organizations.
          Research coaches, teams, and leagues before you make your
          next move.
        </p>
        <form action="/search" method="get" className="search-box">
          <input
            type="search"
            name="q"
            placeholder="Search coaches, teams, or leagues..."
            aria-label="Search coaches, teams, or leagues"
          />
          <button type="submit" className="btn">
            Search
          </button>
        </form>
        <div className="actions">
          <Link href="/signup" className="btn">
            Create Free Account
          </Link>
          <Link href="/dashboard" className="btn dark">
            Explore HoopCheck
          </Link>
        </div>
      </section>
      <section className="grid">
        <div className="card">
          <div className="eyebrow">01</div>
          <h2>Coaches</h2>
          <p>
            Research communication, professionalism, development,
            payment experiences, and player feedback.
          </p>
          <Link href="/coaches" className="btn">
            Explore Coaches
          </Link>
        </div>
        <div className="card">
          <div className="eyebrow">02</div>
          <h2>Teams</h2>
          <p>
            Find out what players have experienced with professional
            organizations before you sign your next contract.
          </p>
          <Link href="/teams" className="btn">
            Explore Teams
          </Link>
        </div>
        <div className="card">
          <div className="eyebrow">03</div>
          <h2>Leagues</h2>
          <p>
            Explore professional basketball leagues and learn from
            players who have already been there.
          </p>
          <Link href="/leagues" className="btn">
            Explore Leagues
          </Link>
        </div>
      </section>
      <section className="hero">
        <div className="eyebrow">Your next move matters</div>
        <h2>
          Research first.
          <br />
          Sign smarter.
        </h2>
        <p>
          HoopCheck gives overseas players a place to research the
          basketball world before committing to their next opportunity.
        </p>
        <div className="actions">
          <Link href="/signup" className="btn">
            Join HoopCheck
          </Link>
          <Link href="/membership" className="btn dark">
            View Membership
          </Link>
        </div>
      </section>
      <style jsx>{`
        .search-box {
          display: flex;
          gap: 12px;
          width: 100%;
          max-width: 720px;
          margin: 32px 0 8px;
        }
        .search-box input {
          flex: 1;
          min-width: 0;
          height: 54px;
          padding: 0 18px;
          border: 1px solid #444;
          border-radius: 8px;
          background: #111;
          color: #fff;
          font-size: 16px;
          outline: none;
        }
        .search-box input::placeholder {
          color: #888;
        }
        .search-box input:focus {
          border-color: #ff6a00;
        }
        .search-box button {
          border: none;
          cursor: pointer;
          white-space: nowrap;
        }
        @media (max-width: 600px) {
          .search-box {
            flex-direction: column;
          }
          .search-box input,
          .search-box button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
