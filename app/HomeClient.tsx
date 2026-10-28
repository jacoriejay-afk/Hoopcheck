"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { getCachedSession, supabase } from "../lib/supabase";
import { MotionNumber } from "../components/HoopMotion";
import CategoryTile, { type CategoryTileKind } from "../components/CategoryTile";
import { HoopIcon, type HoopIconName } from "../components/HoopCheckUI";

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
  const iconByCategory: Record<string, HoopIconName> = {
    basketball: "basketball",
    "women-basketball": "users",
    whistle: "whistle",
    trophy: "trophy",
    player: "user",
    star: "star",
    bell: "shield-check",
  };
  return <HoopIcon name={iconByCategory[name] || "arrow-right"} size={21} className="hc-category-svg" />;
}

export default function Home() {
  const router = useRouter();
  const [directoryCounts, setDirectoryCounts] = useState<{ teams: number; leagues: number } | null>(null);

  useEffect(() => {
    getCachedSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
    let active = true;
    void Promise.all([
      supabase.from("teams").select("id", { count: "exact", head: true }).eq("active", true),
      supabase.from("leagues").select("id", { count: "exact", head: true }).eq("active", true),
    ]).then(([teamsResult, leaguesResult]) => {
      if (active) setDirectoryCounts({ teams: teamsResult.count ?? 0, leagues: leaguesResult.count ?? 0 });
    }).catch(() => { if (active) setDirectoryCounts({ teams: 0, leagues: 0 }); });
    return () => { active = false; };
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
              EXPLORE DIRECTORY <HoopIcon name="arrow-right" size={17} />
            </Link>
            <Link href="/login" className="hc-home-signin">SIGN IN <HoopIcon name="arrow-up-right" size={15} /></Link>
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

      <section className="hc-motion-directory-counts" aria-label="HoopCheck directory totals">
        <div><strong>{directoryCounts ? <MotionNumber value={directoryCounts.teams} label={String(directoryCounts.teams) + " teams"} /> : "—"}</strong><span>TEAMS IN THE DIRECTORY</span></div>
        <div><strong>{directoryCounts ? <MotionNumber value={directoryCounts.leagues} label={String(directoryCounts.leagues) + " leagues"} /> : "—"}</strong><span>LEAGUES COVERED</span></div>
      </section>
      <section className="hc-quick-access" aria-labelledby="hc-quick-access-heading">
        <div className="hc-quick-access-heading">
          <span className="hc-template-eyebrow">YOUR NEXT MOVE</span>
          <h2 id="hc-quick-access-heading">QUICK ACCESS</h2>
        </div>
        <nav className="hc-quick-access-links" aria-label="Quick access">
          <Link href="/teams"><HoopIcon name="basketball" size={19} /> Teams <b aria-hidden="true"><HoopIcon name="arrow-up-right" size={15} /></b></Link>
          <Link href="/coaches"><HoopIcon name="whistle" size={19} /> Coaches <b aria-hidden="true"><HoopIcon name="arrow-up-right" size={15} /></b></Link>
          <Link href="/leagues"><HoopIcon name="trophy" size={19} /> Leagues <b aria-hidden="true"><HoopIcon name="arrow-up-right" size={15} /></b></Link>
          <Link href="/players"><HoopIcon name="users" size={19} /> Find players <b aria-hidden="true"><HoopIcon name="arrow-up-right" size={15} /></b></Link>
          <Link href="/search"><HoopIcon name="star" size={19} /> Reviews <b aria-hidden="true"><HoopIcon name="arrow-up-right" size={15} /></b></Link>
        </nav>
      </section>

      <section className="hc-template-directory" aria-label="Directory preview">
        <div className="hc-template-panel hc-template-directory-panel">
          <div className="hc-template-panel-top">
            <div><span className="hc-template-eyebrow">GLOBAL BASKETBALL</span><h2>DIRECTORY</h2></div>
            <Link href="/teams">VIEW ALL</Link>
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
