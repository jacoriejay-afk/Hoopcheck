import type { Metadata } from "next";
import Link from "next/link";
import CourtLines from "../../components/CourtLines";
import { HoopIcon } from "../../components/HoopCheckUI";
import styles from "./company.module.css";

export const metadata: Metadata = {
  title: "Company & Business | HoopCheck™",
  description: "HoopCheck™ company information, business partnerships, and community commitments.",
};

export default function CompanyPage() {
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <CourtLines variant="full-court" className={styles.court} />
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>HoopCheck™ / Company</p>
          <h1>Know who you’re signing with.</h1>
          <p className={styles.lede}>
            HoopCheck™ helps the global basketball community discover opportunities,
            share firsthand experiences, and make better-informed career decisions.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/business-opportunities">
              Explore opportunities <HoopIcon name="arrow-up-right" size={18} />
            </Link>
            <Link className={styles.secondary} href="/founder">Meet the founder</Link>
          </div>
        </div>
      </header>

      <div className={styles.grid}>
        <section className={styles.card} aria-labelledby="company-community">
          <span className={styles.icon}><HoopIcon name="users" /></span>
          <h2 id="company-community">Who we serve</h2>
          <p>Players, fans, coaches, agents, clubs, and basketball organizations around the world.</p>
        </section>
        <section className={styles.card} aria-labelledby="company-trust">
          <span className={styles.icon}><HoopIcon name="shield-check" /></span>
          <h2 id="company-trust">Trust &amp; accountability</h2>
          <p>We support constructive, responsible sharing of basketball experiences. Community reviews reflect their authors’ views.</p>
        </section>
        <section className={styles.card} aria-labelledby="company-opportunities">
          <span className={styles.icon}><HoopIcon name="basketball" /></span>
          <h2 id="company-opportunities">Business opportunities</h2>
          <p>Explore athlete ambassadorships, sponsorships, strategic partnerships, and investor conversations.</p>
          <Link className={styles.cardLink} href="/business-opportunities">
            View all pathways <HoopIcon name="arrow-right" size={18} />
          </Link>
        </section>
        <section className={styles.card} aria-labelledby="company-details">
          <span className={styles.icon}><HoopIcon name="clipboard-check" /></span>
          <h2 id="company-details">Company details</h2>
          <dl className={styles.details}>
            <div><dt>Founder</dt><dd>Jacorie Archie</dd></div>
            <div><dt>Official website</dt><dd>hoopcheck.online</dd></div>
          </dl>
          <p className={styles.note}>We’ll publish entity, registration, and business address details once verified.</p>
        </section>
      </div>

      <nav className={styles.nav} aria-label="Company pages">
        <Link href="/about">About</Link>
        <Link href="/founder">Founder</Link>
        <Link href="/business-opportunities">Business opportunities</Link>
        <Link href="/partners">Submit an inquiry</Link>
      </nav>
    </main>
  );
}
