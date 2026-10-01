import Link from "next/link";

export default function SignupPage() {
  return (
    <main>
      <nav className="nav">
        <Link href="/" className="logo">
          Hoop<span>Check</span>
        </Link>
      </nav>

      <section className="form">
        <h1>Create your account</h1>

        <p className="muted">
          Join HoopCheck and start researching basketball opportunities
          worldwide.
        </p>

        <form>
          <label>Name</label>
          <input
            className="input"
            type="text"
            placeholder="Your name"
          />

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
            placeholder="Create a password"
          />

          <button type="submit" className="btn">
            Create account
          </button>
        </form>

        <p className="muted">
          Already have an account?{" "}
          <Link href="/login">Log in</Link>
        </p>
      </section>
    </main>
  );
}
