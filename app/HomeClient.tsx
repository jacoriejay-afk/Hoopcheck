"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCachedSession } from "../lib/supabase";
import HomeDirectoryStats from "../components/HomeDirectoryStats";
import { HoopIcon, type HoopIconName } from "../components/HoopCheckUI";
import SearchBar from "../components/SearchBar";
import styles from "./home.module.css";

const directoryLinks = [
  { title: "Men’s teams", detail: "Find clubs by country and league", href: "/teams", icon: "basketball" },
  { title: "Women’s teams", detail: "Explore women’s clubs worldwide", href: "/womens", icon: "basketball" },
  { title: "Leagues", detail: "Explore basketball competitions", href: "/leagues", icon: "trophy" },
  { title: "Coaches", detail: "Discover coaches and their profiles", href: "/coaches", icon: "whistle" },
  { title: "Players", detail: "Find player profiles and career histories", href: "/players", icon: "users" },
  { title: "Reviews", detail: "See what players say about their experience", href: "/reviews", icon: "clipboard-check" },
] satisfies ReadonlyArray<{ title: string; detail: string; href: string; icon: HoopIconName }>;

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    void getCachedSession().then(({ data }) => {
      if (active && data.session) router.replace("/dashboard");
    }).catch(() => {
      // If the session cannot be checked, visitors can still use the public page.
    });
    return () => { active = false; };
  }, [router]);

  return (
    <main className="hc-template-home">
      <div className={styles.home}>
        <section className={styles.hero} aria-labelledby="home-title">
          <div className={styles.arena} aria-hidden="true" />
          <div className={styles.heroContent}>
            <p className={styles.heroKicker}><span /> GLOBAL BASKETBALL DIRECTORY</p>
            <h1 id="home-title">Know who you’re <em>signing with.</em></h1>
            <p className={styles.heroDescription}>
              Research clubs and coaches, learn from player reviews, and follow the game across borders.
            </p>
            <SearchBar
              className={styles.search}
              placeholder="Search the directory"
              ariaLabel="Search the basketball directory"
              required
            />
            <div className={styles.heroActions}>
              <Link href="/signup" className={styles.primary}>Create an account <HoopIcon name="arrow-right" size={17} /></Link>
              <Link href="/login" className={styles.signIn}>Sign in <HoopIcon name="arrow-up-right" size={15} /></Link>
            </div>
          </div>
        </section>

        <div className={styles.stats}><HomeDirectoryStats /></div>

        <section className={styles.section} aria-labelledby="home-directory">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>THE DIRECTORY</p>
              <h2 id="home-directory">Explore basketball worldwide</h2>
            </div>
            <Link href="/directory" className={styles.textLink}>All directories <HoopIcon name="arrow-right" size={16} /></Link>
          </div>
          <ul className={styles.directoryGrid}>
            {directoryLinks.map(({ title, detail, href, icon }) => (
              <li key={href}>
                <Link href={href} className={styles.directoryLink}>
                  <span className={styles.directoryIcon}><HoopIcon name={icon} size={21} /></span>
                  <span className={styles.directoryCopy}><strong>{title}</strong><small>{detail}</small></span>
                  <HoopIcon className={styles.directoryArrow} name="arrow-up-right" size={17} />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="home-features">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>PLAYER TOOLS &amp; FAN FEATURES</p>
              <h2 id="home-features">Before you sign. On game day.</h2>
            </div>
          </div>
          <div className={styles.featureGrid}>
            <article className={styles.playerFeature}>
              <p className={styles.featureLabel}><HoopIcon name="shield-check" size={19} /> FOR PLAYERS</p>
              <h3>Pre-Sign Check</h3>
              <p>Work through six checks covering the club, payment history, contract terms, and player references.</p>
              <Link href="/pre-sign" className={styles.textLink}>Open the checklist <HoopIcon name="arrow-right" size={16} /></Link>
            </article>
            <article>
              <p className={styles.featureLabel}><HoopIcon name="calendar" size={19} /> FOR FANS</p>
              <h3>Live Games</h3>
              <p>See live and upcoming matchups, and follow the teams you care about on game day.</p>
              <Link href="/live-games" className={styles.textLink}>Open the game hub <HoopIcon name="arrow-right" size={16} /></Link>
            </article>
          </div>
        </section>

        <nav className={styles.more} aria-label="More from HoopCheck">
          <Link href="/about" className={styles.textLink}>About HoopCheck™ <HoopIcon name="arrow-up-right" size={16} /></Link>
          <Link href="/membership" className={styles.textLink}>Membership <HoopIcon name="arrow-up-right" size={16} /></Link>
          <Link href="/notifications" className={styles.textLink}>Alerts <HoopIcon name="arrow-up-right" size={16} /></Link>
        </nav>
      </div>
    </main>
  );
}
