"use client";

import Link from "next/link";
import { useLanguage } from "./LanguageProvider";

type DirectoryKey = "teams" | "womens" | "coaches" | "leagues" | "players";
type Props = { kicker: string; title: string; description: string; current: DirectoryKey };

const destinations: Array<{ key: DirectoryKey; href: string; labelKey: string }> = [
  { key: "teams", href: "/teams", labelKey: "mensTeams" },
  { key: "womens", href: "/womens", labelKey: "womensTeams" },
  { key: "coaches", href: "/coaches", labelKey: "coaches" },
  { key: "leagues", href: "/leagues", labelKey: "leagues" },
  { key: "players", href: "/players", labelKey: "players" },
];

export default function DirectoryLayout({ kicker, title, description, current }: Props) {
  const { t } = useLanguage();
  return <>
    <section className="hc-shared-directory-hero">
      <p className="eyebrow">{kicker}</p>
      <h1>{title}</h1>
      <p className="hc-shared-directory-description">{description}</p>
    </section>
    <nav className="hc-shared-directory-tiles" aria-label={t("browseDirectories")}>
      <span className="hc-shared-directory-tiles-label">{t("browseDirectories")}</span>
      <div className="hc-shared-directory-tile-grid">
        {destinations.map((item) => <Link key={item.key} href={item.href} aria-current={current === item.key ? "page" : undefined} className={current === item.key ? "is-current" : ""}>{t(item.labelKey)}</Link>)}
      </div>
    </nav>
  </>;
}
