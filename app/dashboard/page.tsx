import Link from "next/link";

const categories = [
  {
    title: "Coaches",
    description:
      "Research coaches and see player experiences with communication, professionalism, and development.",
  },
  {
    title: "Teams",
    description:
      "Research professional organizations before signing your next contract.",
  },
  {
    title: "Leagues",
    description:
      "Explore player experiences across professional leagues worldwide.",
  },
];

export default function DashboardPage() {
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
        <div className="eyebrow">HoopCheck</div>

        <h1>Research before you sign.</h1>

        <p>
          Find information about coaches, professional teams, and leagues
          from the players who have experienced them.
        </p>

        <div className="actions">
          <input
            className="input"
            type="text"
            placeholder="Search coaches, teams, or leagues..."
          />
        </div>
      </section>

      <section className="grid">
        {categories.map((category) => (
          <div className="card" key={category.title}>
            <h2>{category.title}</h2>

            <p>{category.description}</p>

            <button className="btn">
              Explore {category.title}
            </button>
          </div>
        ))}
      </section>

      <section className="hero">
        <div className="card">
          <h2>HoopCheck Pro</h2>

          <p>
            Unlock full ratings, player reviews, detailed experiences, and
            deeper research tools.
          </p>

          <h2>$7.99/month</h2>

          <button className="btn">
            Get Pro
          </button>
        </div>

        <br />

        <div className="card">
          <h2>HoopCheck Premium</h2>

          <p>
            Get expanded access to HoopCheck's research and premium
            features.
          </p>

          <h2>$15.99/month</h2>

          <button className="btn">
            Get Premium
          </button>
        </div>
      </section>
    </main>
  );
}
