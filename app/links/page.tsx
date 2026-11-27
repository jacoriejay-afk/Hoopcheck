import type { Metadata } from "next";
import Link from "next/link";
import Logo from "../../components/Logo";
import { BioLinkControls, GuestBioNavigation } from "./BioLinkControls";
import { signupLink } from "./campaign.mjs";
import styles from "./links.module.css";

export const metadata: Metadata = {
  title: "Official links",
  description: "Explore HoopCheck, create a free account and research the global basketball world.",
  alternates: { canonical: "/links" },
};

const groups = [
  { title: "Start here", links: [
    { href: "/", title: "Official website", detail: "Your home for global basketball" },
    { href: "/directory", title: "Explore basketball", detail: "Teams, leagues and people" },
    { href: "/pre-sign", title: "Pre-Sign Check", detail: "Research before you commit" },
    { href: "/membership", title: "Memberships", detail: "Compare available plans" },
  ] },
  { title: "Around the game", links: [
    { href: "/live-games", title: "Live Games", detail: "Scores and schedules" },
    { href: "/feed", title: "HoopFeed™", detail: "Member community · sign-in may be required" },
    { href: "/hoopgroups", title: "HoopGroups", detail: "Community spaces · account and availability may vary" },
    { href: "/teams", title: "Men’s teams", detail: "Explore the directory" },
    { href: "/womens", title: "Women’s teams", detail: "Explore the directory" },
    { href: "/leagues", title: "Leagues", detail: "Discover competitions" },
    { href: "/players", title: "Players", detail: "Discover basketball profiles" },
    { href: "/coaches", title: "Coaches", detail: "Research coaches" },
    { href: "/agents", title: "Agents & scouts", detail: "Explore professionals" },
  ] },
  { title: "Our story & business", links: [
    { href: "/founder", title: "Meet our founder", detail: "The story behind HoopCheck" },
    { href: "/about", title: "About HoopCheck", detail: "Our mission" },
    { href: "/partners", title: "Partnerships", detail: "Work with HoopCheck" },
    { href: "/support", title: "Support", detail: "Get help" },
  ] },
];

export default async function LinksPage({ searchParams }: { searchParams: Promise<{ utm_source?: string | string[] }> }) {
  const params = await searchParams;
  return <main className={styles.root}>
    <div className={styles.hero}>
      <div className={styles.actions}><BioLinkControls /></div>
      <Logo variant="full" size={54} title="HoopCheck™" />
      <p className={styles.eyebrow}>THE GLOBAL BASKETBALL INTELLIGENCE HUB</p>
      <h1>Know who you’re signing with.</h1>
      <p className={styles.intro}>Built for players, fans and basketball professionals worldwide.</p>
      <Link className={styles.primary} href={signupLink(params.utm_source)}>Create your free account <span aria-hidden="true">↗</span></Link>
      <Link className={styles.signin} href="/login">Already a member? Sign in</Link>
    </div>
    {groups.map(group => <section className={styles.group} key={group.title} aria-label={group.title}>
      <h2>{group.title}</h2>
      <ul>{group.links.map(item => <li key={item.href}><Link className={styles.link} href={item.href}>
        <span><strong>{item.title}</strong><small>{item.detail}</small></span><span className={styles.arrow} aria-hidden="true">↗</span>
      </Link></li>)}</ul>
    </section>)}
    <p className={styles.end}>Built for the game. · HoopCheck™</p>
    <GuestBioNavigation />
  </main>;
}
