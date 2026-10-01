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
            Join HoopCheck
          </Link>
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">
          Built for overseas basketball players
        </div>

        <h1>Know who you're signing with.</h1>

        <p>
          Research coaches, teams, and leagues through player ratings and
          real experiences before your next overseas basketball opportunity.
        </p>

        <div className="actions">
          <Link href="/signup" className="btn">
            Create free account
          </Link>

          <Link href="/dashboard" className="btn dark">
            Explore HoopCheck
          </Link>
        </div>
      </section>

      <section className="grid">
        <div className="card">
          <h2>Coaches</h2>
          <p>
            Research communication, professionalism, and player development.
          </p>
        </div>

        <div className="card">
          <h2>Teams</h2>
          <p>
            See what players report about organizations before you sign.
          </p>
        </div>

        <div className="card">
          <h2>Leagues</h2>
          <p>
            Explore player experiences across professional leagues worldwide.
          </p>
        </div>
      </section>
    </main>
  );
}
