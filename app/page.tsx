"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCachedSession } from "../lib/supabase";

const categories = [
  { label: "Men's Teams", subtitle: "Global men's professional and club teams", href: "/teams", color: "#ff6a00", icon: "◉" },
  { label: "Women's Teams", subtitle: "Global women's professional and club teams", href: "/womens", color: "#e72c70", icon: "◉" },
  { label: "Coaches", subtitle: "Verified coach experiences worldwide", href: "/coaches", color: "#1769b0", icon: "♧" },
  { label: "Leagues", subtitle: "National and international leagues", href: "/leagues", color: "#16845c", icon: "♜" },
  { label: "Find Players", subtitle: "Connect with players globally", href: "/players", color: "#6639a8", icon: "♙" },
  { label: "Reviews", subtitle: "Real feedback from real players", href: "/search", color: "#34383d", icon: "★" },
  { label: "Alerts", subtitle: "Updates, news and more", href: "/notifications", color: "#eda900", icon: "♧" },
];

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    getCachedSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  return (
    <main className="hc-template-home">
      <section className="hc-template-hero">
        <div className="hc-template-hero-copy">
          <h1>KNOW WHO YOU’RE<br />SIGNING WITH</h1>
          <p>Real reviews. Verified profiles. Global basketball.<br className="hc-desktop-break" /> Coaches. Teams. Leagues. Players.</p>
          <Link href="/teams" className="hc-template-cta">EXPLORE DIRECTORY <span aria-hidden="true">→</span></Link>
        </div>
        <div className="hc-template-hero-art" aria-hidden="true">
          <div className="hc-template-court-lines" />
          <div className="hc-template-ball"><span /><i /><b /></div>
          <div className="hc-template-slash hc-template-slash-one" />
          <div className="hc-template-slash hc-template-slash-two" />
        </div>
      </section>

      <section className="hc-template-explore" aria-labelledby="hc-template-explore-heading">
        <div className="hc-template-section-title">
          <h2 id="hc-template-explore-heading">EXPLORE HOOPCHECK</h2>
          <Link href="/teams">VIEW DIRECTORY <span aria-hidden="true">→</span></Link>
        </div>
        <div className="hc-template-category-grid">
          {categories.map((category) => (
            <Link href={category.href} key={category.label} className="hc-template-category" style={{ "--tile-color": category.color } as React.CSSProperties}>
              <span className="hc-template-category-icon" aria-hidden="true">{category.icon}</span>
              <strong>{category.label}</strong>
              <span className="hc-template-category-arrow" aria-hidden="true">→</span>
              <small>{category.subtitle}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="hc-template-directory" aria-label="Directory preview">
        <div className="hc-template-panel hc-template-directory-panel">
          <div className="hc-template-panel-top">
            <div><span className="hc-template-eyebrow">GLOBAL BASKETBALL</span><h2>DIRECTORY</h2></div>
            <Link href="/teams">VIEW ALL →</Link>
          </div>
          <p>Find teams, coaches, and leagues from around the world.</p>
          <div className="hc-template-directory-links">
            {categories.slice(0, 4).map((category) => (
              <Link href={category.href} key={category.label}>
                <span className="hc-template-mini-icon" style={{ "--tile-color": category.color } as React.CSSProperties}>{category.icon}</span>
                <span><strong>{category.label}</strong><small>{category.subtitle}</small></span>
                <b aria-hidden="true">›</b>
              </Link>
            ))}
          </div>
        </div>
        <div className="hc-template-panel hc-template-player-panel">
          <span className="hc-template-eyebrow">BEFORE YOU SIGN</span>
          <h2>REAL TEAMS.<br />REAL COACHES.<br /><span>REAL REVIEWS.</span></h2>
          <p>Use shared player experiences to ask better questions and make informed decisions about your next opportunity.</p>
          <Link href="/search" className="hc-template-outline-link">EXPLORE REVIEWS <span aria-hidden="true">→</span></Link>
          <div className="hc-template-orbit" aria-hidden="true" />
        </div>
      </section>
    </main>
  );
}
