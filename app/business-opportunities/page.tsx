import type { Metadata } from "next";
import Link from "next/link";
import CourtLines from "../../components/CourtLines";
import { HoopIcon } from "../../components/HoopCheckUI";
import styles from "../company/company.module.css";

export const metadata: Metadata = {
  title: "Business Opportunities | HoopCheck™",
  description: "Explore athlete ambassador, sponsorship, strategic partnership, and investor conversations with HoopCheck™.",
};

const opportunities = [
  {
    title: "Athlete ambassadors",
    icon: "star",
    description: "Help introduce HoopCheck™ to basketball communities through content, education, and referrals.",
    details: "Discuss campaign expectations, audience fit, content rights, and any proposed referral compensation.",
  },
  {
    title: "Sponsors",
    icon: "trophy",
    description: "Support basketball campaigns, community initiatives, and brand collaborations.",
    details: "Share your brand, campaign goals, audience, budget range, and preferred timeline.",
  },
  {
    title: "Strategic partners",
    icon: "users",
    description: "Explore collaborations with teams, leagues, agents, coaches, and basketball organizations.",
    details: "Tell us what your organization does and how a partnership could benefit the basketball community.",
  },
  {
    title: "Investors",
    icon: "message-square",
    description: "Start a conversation about HoopCheck™ and its long-term business direction.",
    details: "Inquiries are for initial discussions only. Any securities offering or investment requires separate review and documentation.",
  },
] as const;

export default function BusinessOpportunitiesPage() {
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <CourtLines variant="full-court" className={styles.court} />
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>HoopCheck™ / Business opportunities</p>
          <h1>Work with HoopCheck™.</h1>
          <p className={styles.lede}>
            Help build a better-connected basketball community. Explore the opportunity that fits your goals.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/partners">
              Start a conversation <HoopIcon name="arrow-up-right" size={18} />
            </Link>
            <Link className={styles.secondary} href="/company">Company information</Link>
          </div>
        </div>
      </header>

      <div className={styles.grid}>
        {opportunities.map(({ title, icon, description, details }) => (
          <section className={styles.card} key={title}>
            <span className={styles.icon}><HoopIcon name={icon} /></span>
            <h2>{title}</h2>
            <p>{description}</p>
            <p className={styles.note}>{details}</p>
            <Link className={styles.cardLink} href="/partners" aria-label={`Inquire about ${title.toLowerCase()}`}>
              Inquire <HoopIcon name="arrow-right" size={18} />
            </Link>
          </section>
        ))}
      </div>

      <section className={styles.card} aria-labelledby="inquiry-details">
        <h2 id="inquiry-details">How inquiries work</h2>
        <p>Use the business inquiry form to describe the opportunity you’re interested in. Sign-in may be required.</p>
        <p className={styles.note}>Inquiries start a conversation. Partnerships, ambassador appointments, and investments require separate agreements.</p>
        <Link className={styles.cardLink} href="/partners">
          Open the inquiry form <HoopIcon name="arrow-right" size={18} />
        </Link>
      </section>

      <nav className={styles.nav} aria-label="Company information">
        <Link href="/about">About</Link>
        <Link href="/founder">Founder</Link>
        <Link href="/company">Company</Link>
      </nav>
    </main>
  );
}
