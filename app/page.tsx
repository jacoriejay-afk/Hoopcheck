"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { getCachedSession } from "../lib/supabase";
import CategoryTile, { type CategoryTileKind } from "../components/CategoryTile";

const categories: {
  label: string;
  subtitle: string;
  href: string;
  color: string;
  icon: string;
  category: CategoryTileKind;
}[] = [
  { label: "Men's Teams", subtitle: "Global men's professional and club teams", href: "/teams", color: "var(--hc-category-teams)", icon: "basketball", category: "teams" },
  { label: "Women's Teams", subtitle: "Global women's professional and club teams", href: "/womens", color: "var(--hc-category-womens)", icon: "women-basketball", category: "womens" },
  { label: "Coaches", subtitle: "Verified coach experiences worldwide", href: "/coaches", color: "var(--hc-category-coaches)", icon: "whistle", category: "coaches" },
  { label: "Leagues", subtitle: "National and international leagues", href: "/leagues", color: "var(--hc-category-leagues)", icon: "trophy", category: "leagues" },
  { label: "Find Players", subtitle: "Connect with players globally", href: "/players", color: "var(--hc-category-players)", icon: "player", category: "players" },
  { label: "Reviews", subtitle: "Real feedback from real players", href: "/search", color: "var(--hc-category-reviews)", icon: "star", category: "reviews" },
  { label: "Alerts", subtitle: "Updates, news and more", href: "/notifications", color: "var(--hc-category-alerts)", icon: "bell", category: "alerts" },
];

function CategoryIcon({ name }: { name: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="hc-category-svg" {...common}>
      {name === "basketball" && <><circle cx="16" cy="16" r="11" /><path d="M5 16h22M16 5c-5 5-5 17 0 22M16 5c5 5 5 17 0 22M7.5 8.5c5 3 12 12 17 15M24.5 8.5c-5 3-12 12-17 15" /></>}
      {name === "women-basketball" && <><circle cx="16" cy="16" r="11" /><path d="M5 16h22M16 5c-5 5-5 17 0 22M16 5c5 5 5 17 0 22M11 2v4M21 2v4M11 26v4M21 26v4" /></>}
      {name === "whistle" && <><path d="M5 12h13l7 5-6 7H9a4 4 0 0 1-4-4z" /><circle cx="20" cy="12" r="3" /><path d="M5 16H2v5h4" /></>}
      {name === "trophy" && <><path d="M10 5h12v7a6 6 0 0 1-12 0zM10 8H5v3a5 5 0 0 0 5 5M22 8h5v3a5 5 0 0 1-5 5M16 18v6M11 27h10M12 24h8" /></>}
      {name === "player" && <><circle cx="13" cy="9" r="4" /><path d="M5 25v-2a8 8 0 0 1 12-7M23 15v12M17 21h12" /></>}
      {name === "star" && <path d="m16 3 4 8 9 1-6.5 6 1.8 9L16 22.5 7.7 27l1.8-9L3 12l9-1z" />}
      {name === "bell" && <><path d="M7 22h18l-2.5-4V12a6.5 6.5 0 0 0-13 0v6zM13 26a3 3 0 0 0 6 0" /></>}
    </svg>
  );
}

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    getCachedSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  return (
    <main className="hc-template-home hc-home-redesign">
      <section className="hc-template-hero hc-home-hero">
        <div className="hc-template-hero-copy hc-home-hero-copy">
          <div className="hc-home-kicker"><span /> THE GLOBAL BASKETBALL INTELLIGENCE HUB</div>
          <h1>KNOW WHO YOU’RE<br />SIGNING WITH</h1>
          <p>
            Real reviews. Verified profiles. Global basketball.
            <br className="hc-desktop-break" /> Coaches. Teams. Leagues. Players.
          </p>
          <div className="hc-home-hero-actions">
            <Link href="/teams" className="hc-template-cta hc-home-cta">
              EXPLORE DIRECTORY <span aria-hidden="true">→</span>
            </Link>
            <Link href="/login" className="hc-home-signin">SIGN IN <span aria-hidden="true">↗</span></Link>
          </div>
        </div>

        <div className="hc-template-hero-art hc-home-hero-art" aria-hidden="true">
          <div className="hc-template-court-lines" />
          <div className="hc-home-image-frame">
            <Image
              src="https://images.unsplash.com/photo-1519861531473-9200262188bf?auto=format&fit=crop&w=1100&q=85"
              alt=""
              fill
              priority
              unoptimized
              sizes="(max-width: 760px) 78vw, 42vw"
              className="hc-home-basketball-image"
            />
          </div>
          <div className="hc-home-diagonal hc-home-diagonal-one" />
          <div className="hc-home-diagonal hc-home-diagonal-two" />
        </div>
      </section>

      <section className="hc-template-explore hc-home-explore" aria-labelledby="hc-template-explore-heading">
        <div className="hc-template-section-title">
          <div>
            <span className="hc-template-eyebrow">YOUR NEXT MOVE</span>
            <h2 id="hc-template-explore-heading">EXPLORE HOOPCHECK</h2>
          </div>
          <Link href="/directory">ALL CATEGORIES <span aria-hidden="true">→</span></Link>
        </div>
        <div className="hc-template-category-grid hc-home-category-grid">
          {categories.map((category) => (
            <CategoryTile
              key={category.label}
              label={category.label}
              category={category.category}
              href={category.href}
              description={category.subtitle}
              className="hc-home-category-tile"
            />
          ))}
        </div>
      </section>

      <section className="hc-quick-access" aria-labelledby="hc-quick-access-heading">
        <div className="hc-quick-access-heading">
          <span className="hc-template-eyebrow">YOUR NEXT MOVE</span>
          <h2 id="hc-quick-access-heading">QUICK ACCESS</h2>
        </div>
        <nav className="hc-quick-access-links" aria-label="Quick access">
          <Link href="/teams"><span aria-hidden="true">◉</span> Teams <b aria-hidden="true">↗</b></Link>
          <Link href="/coaches"><span aria-hidden="true">✳</span> Coaches <b aria-hidden="true">↗</b></Link>
          <Link href="/leagues"><span aria-hidden="true">🏆</span> Leagues <b aria-hidden="true">↗</b></Link>
          <Link href="/players"><span aria-hidden="true">＋</span> Find players <b aria-hidden="true">↗</b></Link>
          <Link href="/search"><span aria-hidden="true">★</span> Reviews <b aria-hidden="true">↗</b></Link>
        </nav>
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
                <span className="hc-template-mini-icon" style={{ "--tile-color": category.color } as CSSProperties}><CategoryIcon name={category.icon} /></span>
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
