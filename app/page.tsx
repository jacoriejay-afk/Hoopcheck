"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCachedSession } from "../lib/supabase";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    getCachedSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  return (
    <main>
      <section className="hero">
        <div className="eyebrow">Built for overseas basketball</div>
        <h1>Know who<br />you&apos;re<br />signing with.</h1>
        <p>
          HoopCheck is a private basketball research community. Create an account
          or sign in to access player experiences, coaches, teams, leagues, and
          professional basketball connections.
        </p>
        <div className="actions">
          <Link href="/signup" className="btn">Create Free Account</Link>
          <Link href="/login" className="btn dark">Sign In</Link>
        </div>
        <p className="muted" style={{ marginTop: 18 }}>
          An account is required to enter HoopCheck.
        </p>
      </section>

      <section className="grid">
        <div className="card"><div className="eyebrow">01</div><h2>Players</h2><p>Discover professional players, verified profiles, and first-hand basketball experiences.</p></div>
        <div className="card"><div className="eyebrow">02</div><h2>Coaches</h2><p>Research communication, professionalism, development, payment experiences, and player feedback.</p></div>
        <div className="card"><div className="eyebrow">03</div><h2>Teams</h2><p>Learn what players have experienced with professional organizations before you sign.</p></div>
        <div className="card"><div className="eyebrow">04</div><h2>Leagues</h2><p>Explore professional basketball markets through experiences shared by players.</p></div>
      </section>

      <section className="hero">
        <div className="eyebrow">Private community access</div>
        <h2>Research first.<br />Sign smarter.</h2>
        <p>Join HoopCheck to access the basketball research tools and community. An account is required for research and member content.</p>
        <div className="actions">
          <Link href="/signup" className="btn">Join HoopCheck</Link>
          <Link href="/login" className="btn dark">Already a Member? Sign In</Link>
        </div>
      </section>
    </main>
  );
}
