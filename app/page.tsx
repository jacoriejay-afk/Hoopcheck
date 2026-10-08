"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCachedSession } from "../lib/supabase";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    getCachedSession().then(({ data }) => {
      const signedIn = Boolean(data.session);
      if (signedIn) router.replace("/dashboard");
    });
  }, [router]);
  return (
    <main>
      <section className="hero">
        <div className="eyebrow">Built for overseas basketball</div>
        <h1>Know who<br />you&apos;re<br />signing with.</h1>
        <p>
          Real player experiences. Real basketball organizations. Research
          coaches, teams, leagues, and players before your next move.
        </p>
        <form action="/search" method="get" className="search-box">
          <input type="search" name="q"
            placeholder="Search players, coaches, teams, or leagues..."
            aria-label="Search players, coaches, teams, or leagues" />
          <button type="submit" className="btn">Search</button>
        </form>
        <div className="actions">
          <Link href="/signup" className="btn">Create Free Account</Link>
          <Link href="/login" className="btn dark">Sign In</Link>
          <Link href="/search" className="btn dark">Explore HoopCheck</Link>
        </div>
      </section>

      <section className="grid">
        <div className="card">
          <div className="eyebrow">01</div>
          <h2>Players</h2>
          <p>Discover professional players, verified profiles, and the people behind first-hand basketball experiences.</p>
          <Link href="/search?type=players" className="btn">Find Players</Link>
        </div>
        <div className="card">
          <div className="eyebrow">02</div>
          <h2>Coaches</h2>
          <p>Research communication, professionalism, development, payment experiences, and player feedback.</p>
          <Link href="/coaches" className="btn">Explore Coaches</Link>
        </div>
        <div className="card">
          <div className="eyebrow">03</div>
          <h2>Teams</h2>
          <p>Find out what players have experienced with professional organizations before you sign.</p>
          <Link href="/teams" className="btn">Explore Teams</Link>
        </div>
        <div className="card">
          <div className="eyebrow">04</div>
          <h2>Leagues</h2>
          <p>Explore professional basketball leagues and learn from players who have already been there.</p>
          <Link href="/leagues" className="btn">Explore Leagues</Link>
        </div>
      </section>

      <section className="hero">
        <div className="eyebrow">Your next move matters</div>
        <h2>Research first.<br />Sign smarter.</h2>
        <p>
          HoopCheck gives professional players a trusted place to research
          basketball environments and share first-hand experiences.
        </p>
        <div className="actions">
          <Link href="/signup" className="btn">Join HoopCheck</Link>
          <Link href="/membership" className="btn dark">View Membership</Link>
        </div>
      </section>
    </main>
  );
}
