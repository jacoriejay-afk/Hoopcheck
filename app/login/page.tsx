import Link from "next/link";

export default function LoginPage() {
  return (
    <main>
      <nav className="nav">
        <Link href="/" className="logo">
          Hoop<span>Check</span>
        </Link>
      </nav>

      <section className="form">
        <h1>Welcome back</h1>

        <p className="muted">
          Log in to access your HoopCheck account.
        </p>

        <form>
          <label>Email</label>
          <input
            className="input"
            type="email"
            placeholder="you@example.com"
          />

          <label>Password</label>
          <input
            className="input"
            type="password"
            placeholder="••••••••"
          />

          <button type="submit" className="btn">
            Log in
          </button>
        </form>

        <p className="muted">
          Don't have an account?{" "}
          <Link href="/signup">Create one</Link>
        </p>
      </section>
    </main>
  );
}
