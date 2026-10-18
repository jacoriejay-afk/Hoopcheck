"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCachedSession } from "../lib/supabase";

const categories = [
  { label: "Men's Teams", subtitle: "Explore men's professional teams worldwide", href: "/teams", icon: "◉" },
  { label: "Women's Teams", subtitle: "Women's clubs, leagues, and player experiences", href: "/womens", icon: "◎" },
  { label: "Coaches", subtitle: "Research coaching reputations and experiences", href: "/coaches", icon: "✳" },
  { label: "Leagues", subtitle: "Compare leagues before your next move", href: "/leagues", icon: "⌁" },
  { label: "Find Players", subtitle: "Connect with players around the world", href: "/players", icon: "＋" },
  { label: "Player Reviews", subtitle: "Learn from first-hand player feedback", href: "/search", icon: "★" },
  { label: "Alerts", subtitle: "Keep up with your account activity", href: "/notifications", icon: "↗" },
  { label: "Directory", subtitle: "Browse the global basketball network", href: "/directory", icon: "▦" },
];

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    getCachedSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    }).catch(() => undefined);
  }, [router]);

  return (
    <main className="hc-scratch-home">
      <div className="hc-scratch-container">
        <section className="hc-scratch-hero">
          <div className="hc-scratch-copy">
            <div className="hc-scratch-kicker">The global basketball intelligence hub</div>
            <h1 className="hc-scratch-title">Know who<br />you’re <span>signing with.</span></h1>
            <p className="hc-scratch-description">
              Your next contract should come with confidence. Research teams, coaches, and leagues through player experiences before you make the move.
            </p>
            <div className="hc-scratch-actions">
              <Link href="/directory" className="hc-button-primary">Explore the directory <span aria-hidden="true">↗</span></Link>
              <Link href="/search" className="hc-button-secondary">Read player reviews <span aria-hidden="true">→</span></Link>
            </div>
            <div className="hc-scratch-proof">
              <span>Built for overseas players</span>
              <span>Teams · Coaches · Leagues</span>
            </div>
          </div>
          <div className="hc-scratch-art" aria-label="Basketball artwork">
            <span className="hc-scratch-index">HC / 001</span>
            <div className="hc-scratch-art-frame"><span className="hc-scratch-art-label">Make your next move informed</span></div>
            <div className="hc-scratch-ball" aria-hidden="true">
              <i className="hc-ball-line-a" /><i className="hc-ball-line-b" /><i className="hc-ball-line-c" />
            </div>
            <span className="hc-scratch-vertical">RESEARCH BEFORE YOU SIGN</span>
          </div>
        </section>
      </div>

      <div className="hc-scratch-strip">
        <div className="hc-scratch-container hc-scratch-strip-inner">
          <div className="hc-scratch-stat"><strong>Know the team</strong><span>Before you commit</span></div>
          <div className="hc-scratch-stat"><strong>Know the coach</strong><span>Learn from players</span></div>
          <div className="hc-scratch-stat"><strong>Know the league</strong><span>Compare your options</span></div>
          <div className="hc-scratch-stat"><strong>Own your move</strong><span>Make informed choices</span></div>
        </div>
      </div>

      <section className="hc-scratch-section">
        <div className="hc-scratch-container">
          <div className="hc-scratch-section-heading">
            <div>
              <div className="hc-scratch-eyebrow">Your next move starts here</div>
              <h2>Research the<br />basketball world.</h2>
            </div>
            <p>One place to explore the organizations and people that can shape your career. Start with a category and get the context you need.</p>
          </div>
          <div className="hc-scratch-category-grid">
            {categories.map((category, index) => (
              <Link href={category.href} className="hc-scratch-category" key={category.label}>
                <span className="hc-scratch-category-icon" aria-hidden="true">{category.icon}</span>
                <span className="hc-scratch-category-arrow" aria-hidden="true">↗</span>
                <strong>{category.label}</strong>
                <small>{category.subtitle}</small>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="hc-scratch-section" style={{ paddingTop: 0 }}>
        <div className="hc-scratch-container">
          <div className="hc-scratch-bottom">
            <div>
              <div className="hc-scratch-eyebrow">Before you sign</div>
              <h2>Real experiences.<br /><span>Smarter decisions.</span></h2>
              <p>Use player-shared experiences to ask better questions, spot concerns, and prepare for your next opportunity. Reviews are a starting point for research—not a substitute for your own due diligence.</p>
            </div>
            <Link href="/search" className="hc-button-primary">Explore reviews <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </section>
    </main>
  );
}
