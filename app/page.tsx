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
    <main className="hoopcheck-landing">
      <section className="hero">
        <div className="eyebrow">Built for overseas basketball</div>
        <h1>Know who<br />you&apos;re signing with.</h1>
        <p>
          Before you commit to a team, coach, or league, learn from the
          experiences players share. HoopCheck helps overseas basketball
          professionals make more informed decisions.
        </p>
        <div className="actions">
          <Link href="/signup" className="btn">Create Free Account</Link>
          <Link href="/login" className="btn dark">Sign In</Link>
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          Member access is private. Create an account to enter HoopCheck.
        </p>
      </section>

      <section className="hero compact-section" aria-labelledby="sample-review-title">
        <div className="eyebrow">Preview the experience · illustrative example</div>
        <h2 id="sample-review-title">The details that matter before you sign.</h2>
        <div className="card compact-card" style={{ marginTop: 12 }}>
          <div className="review-line">
            <strong>Professional team experience</strong>
            <span className="muted">Example only</span>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            Team and reviewer details are hidden in this sample. A member review
            can help players evaluate topics such as payment timing,
            communication, living arrangements, and professionalism.
          </p>
          <div className="actions">
            <span className="filter-chip">Payment experience</span>
            <span className="filter-chip">Communication</span>
            <span className="filter-chip">Player support</span>
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>
            This is a layout preview, not a real player review or a claim about
            any team. Individual experiences are not guarantees of future results.
          </p>
        </div>
      </section>

      <section className="hero compact-section" aria-labelledby="how-it-works-title">
        <div className="eyebrow">How HoopCheck works</div>
        <h2 id="how-it-works-title">Three steps. Better-informed decisions.</h2>
        <div className="grid compact-grid">
          <div className="card compact-card">
            <div className="eyebrow">01 · Search</div>
            <h2>Find the organization</h2>
            <p>Look up professional teams, coaches, and leagues.</p>
          </div>
          <div className="card compact-card">
            <div className="eyebrow">02 · Learn</div>
            <h2>Read player experiences</h2>
            <p>Consider available feedback on communication, professionalism, and payment experiences.</p>
          </div>
          <div className="card compact-card">
            <div className="eyebrow">03 · Decide</div>
            <h2>Sign with more context</h2>
            <p>Use multiple sources and ask direct questions before making a commitment.</p>
          </div>
        </div>
      </section>

      <section className="hero compact-section">
        <div className="eyebrow">Built around player trust</div>
        <h2>Get paid. Ask better questions. Choose with context.</h2>
        <p>
          Reviews are one input—not a guarantee. Look for specific details,
          compare perspectives, and do your own due diligence before signing.
        </p>
        <div className="actions">
          <Link href="/signup" className="btn">Join HoopCheck</Link>
          <Link href="/login" className="btn dark">Sign In</Link>
        </div>
      </section>
    </main>
  );
}
