"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { useLanguage } from "./LanguageProvider";

type DirectoryKey = "teams" | "womens" | "coaches" | "leagues" | "players";
type Props = { current: DirectoryKey };

const destinations: Array<{ key: DirectoryKey; href: string; labelKey: string }> = [
  { key: "teams", href: "/teams", labelKey: "mensTeams" },
  { key: "womens", href: "/womens", labelKey: "womensTeams" },
  { key: "coaches", href: "/coaches", labelKey: "coaches" },
  { key: "leagues", href: "/leagues", labelKey: "leagues" },
  { key: "players", href: "/players", labelKey: "players" },
];

export default function DirectoryLayout({ current }: Props) {
  const headerKeys: Record<DirectoryKey, { title: string; description: string }> = {
    teams: { title: "teamsDirectoryTitle", description: "teamsDirectoryDescription" },
    womens: { title: "womensDirectoryTitle", description: "womensDirectoryDescription" },
    coaches: { title: "coachesDirectoryTitle", description: "coachesDirectoryDescription" },
    leagues: { title: "leaguesDirectoryTitle", description: "leaguesDirectoryDescription" },
    players: { title: "playersDirectoryTitle", description: "playersDirectoryDescription" },
  };
  const { t } = useLanguage();
  const [showPlayers, setShowPlayers] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase.from("profiles").select("account_type").eq("id", session.user.id).maybeSingle();
      if (active) setShowPlayers(Boolean(data && data.account_type !== "fan"));
    })();
    return () => { active = false; };
  }, []);
  return <>
    <section className="hc-shared-directory-hero">
      <p className="eyebrow">{t("directoryKicker")}</p>
      <h1>{t(headerKeys[current].title)}</h1>
      <p className="hc-shared-directory-description">{t(headerKeys[current].description)}</p>
    </section>
    <nav className="hc-shared-directory-tiles" aria-label={t("browseDirectories")}>
      <span className="hc-shared-directory-tiles-label">{t("browseDirectories")}</span>
      <div className="hc-shared-directory-tile-grid">
        {destinations.filter((item) => item.key !== "players" || showPlayers).map((item) => <Link key={item.key} href={item.href} aria-current={current === item.key ? "page" : undefined} className={current === item.key ? "is-current" : ""}>{t(item.labelKey)}</Link>)}
      </div>
    </nav>
  </>;
}
