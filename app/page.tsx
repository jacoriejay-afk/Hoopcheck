"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCachedSession } from "../lib/supabase";
import CategoryTile, { type CategoryTileKind } from "../components/CategoryTile";

const categories: {
  label: string;
  subtitle: string;
  href: string;
  category: CategoryTileKind;
}[] = [
  { label: "Men's Teams", subtitle: "Global men's professional and club teams", href: "/teams", category: "teams" },
  { label: "Women's Teams", subtitle: "Global women's professional and club teams", href: "/womens", category: "womens" },
  { label: "Coaches", subtitle: "Verified coach experiences worldwide", href: "/coaches", category: "coaches" },
  { label: "Leagues", subtitle: "National and international leagues", href: "/leagues", category: "leagues" },
  { label: "Find Players", subtitle: "Connect with players globally", href: "/players", category: "players" },
  { label: "Reviews", subtitle: "Real feedback from real players", href: "/search", category: "reviews" },
  { label: "Alerts", subtitle: "Updates, news and more", href: "/notifications", category: "alerts" },
];

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
          <Link href="/teams" className="hc-template-cta hc-home-cta">
            EXPLORE DIRECTORY <span aria-hidden="true">→</span>
          </Link>
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
    </main>
  );
}
