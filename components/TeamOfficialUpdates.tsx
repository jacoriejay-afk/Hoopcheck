"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TeamLogo from "./TeamLogo";
import TeamOfficialPrivateImage from "./TeamOfficialPrivateImage";
import { supabase } from "../lib/supabase";
import { useLanguage, type Language } from "./LanguageProvider";


const copy: Record<Language, { kicker: string; title: string; official: string; fallback: string }> = {
  en: { kicker: "OFFICIAL TEAM UPDATES", title: "From the clubs", official: "OFFICIAL", fallback: "Official team" },
  es: { kicker: "NOVEDADES OFICIALES", title: "Desde los clubes", official: "OFICIAL", fallback: "Equipo oficial" },
  fr: { kicker: "ACTUALITÉS OFFICIELLES", title: "Du côté des clubs", official: "OFFICIEL", fallback: "Équipe officielle" },
  de: { kicker: "OFFIZIELLE TEAM-NEWS", title: "Neuigkeiten der Vereine", official: "OFFIZIELL", fallback: "Offizielles Team" },
  tr: { kicker: "RESMÎ TAKIM GÜNCELLEMELERİ", title: "Kulüplerden", official: "RESMÎ", fallback: "Resmî takım" },
  pt: { kicker: "NOVIDADES OFICIAIS", title: "Dos clubes", official: "OFICIAL", fallback: "Equipa oficial" },
  it: { kicker: "AGGIORNAMENTI UFFICIALI", title: "Dai club", official: "UFFICIALE", fallback: "Squadra ufficiale" },
  el: { kicker: "ΕΠΙΣΗΜΕΣ ΕΝΗΜΕΡΩΣΕΙΣ", title: "Από τους συλλόγους", official: "ΕΠΙΣΗΜΟ", fallback: "Επίσημη ομάδα" },
  ar: { kicker: "تحديثات الفريق الرسمية", title: "من الأندية", official: "رسمي", fallback: "الفريق الرسمي" },
  ru: { kicker: "ОФИЦИАЛЬНЫЕ НОВОСТИ КОМАНД", title: "От клубов", official: "ОФИЦИАЛЬНО", fallback: "Официальная команда" },
  az: { kicker: "RƏSMİ KOMANDA YENİLİKLƏRİ", title: "Klublardan", official: "RƏSMİ", fallback: "Rəsmi komanda" },
  pl: { kicker: "OFICJALNE AKTUALNOŚCI", title: "Wiadomości od klubów", official: "OFICJALNE", fallback: "Oficjalna drużyna" },
  zh: { kicker: "球队官方动态", title: "来自俱乐部", official: "官方", fallback: "官方球队" },
  ja: { kicker: "チーム公式アップデート", title: "クラブからのお知らせ", official: "公式", fallback: "公式チーム" },
  sr: { kicker: "ZVANIČNE VESTI TIMA", title: "Iz klubova", official: "ZVANIČNO", fallback: "Zvanični tim" },
  fi: { kicker: "JOUKKUEEN VIRALLISET UUTISET", title: "Seuroilta", official: "VIRALLINEN", fallback: "Virallinen joukkue" },
  he: { kicker: "עדכונים רשמיים של הקבוצה", title: "מהמועדונים", official: "רשמי", fallback: "קבוצה רשמית" },
  lt: { kicker: "OFICIALIOS KOMANDŲ NAUJIENOS", title: "Iš klubų", official: "OFICIALU", fallback: "Oficiali komanda" },
  uk: { kicker: "ОФІЦІЙНІ НОВИНИ КОМАНД", title: "Від клубів", official: "ОФІЦІЙНО", fallback: "Офіційна команда" },
};

type OfficialPost = {
  id: string;
  team_id: string;
  body: string;
  image_url: string | null;
  created_at: string;
  teams?: { name: string; logo_url: string | null; logo_bg: string | null } | null;
};

export default function TeamOfficialUpdates({ teamId }: { teamId?: string }) {
  const { language, formatDate } = useLanguage();
  const labels = copy[language] || copy.en;
  const [posts, setPosts] = useState<OfficialPost[]>([]);
  useEffect(() => {
    let active = true;
    void (async () => {
      let query = (supabase as any).from("team_fanfeed_posts")
        .select("id,team_id,body,image_url,created_at,teams(name,logo_url,logo_bg)")
        .eq("status", "published").order("created_at", { ascending: false }).limit(30);
      if (teamId) query = query.eq("team_id", teamId);
      const { data } = await query;
      if (active) setPosts((data || []).map((row: any) => ({ ...row, teams: Array.isArray(row.teams) ? row.teams[0] : row.teams })) as OfficialPost[]);
    })();
    return () => { active = false; };
  }, [teamId]);
  if (!posts.length) return null;
  return <section className="dashboard-card" style={{ marginTop: 18, padding: 18 }}>
    <p className="eyebrow">{labels.kicker}</p>
    <h2>{labels.title}</h2>
    <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
      {posts.map(post => <article key={post.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
        <Link href={"/teams/" + post.team_id} style={{ display: "inline-flex", alignItems: "center", gap: 9, fontWeight: 800 }}>
          {post.teams && <TeamLogo name={post.teams.name} logoUrl={post.teams.logo_url} logoBg={post.teams.logo_bg as any} size={30} />}
          {post.teams?.name || labels.fallback}
          <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: ".08em", color: "var(--orange)", border: "1px solid var(--orange)", borderRadius: 999, padding: "3px 7px" }}>{labels.official}</span>
        </Link>
        {post.image_url && <TeamOfficialPrivateImage postId={post.id} reference={post.image_url} alt={labels.kicker + ": " + (post.teams?.name || labels.fallback)} />}
        <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{post.body}</p>
        <small className="muted">{formatDate(post.created_at, { dateStyle: "medium", timeStyle: "short" })}</small>
      </article>)}
    </div>
  </section>;
}
