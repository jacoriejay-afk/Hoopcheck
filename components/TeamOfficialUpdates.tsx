"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TeamLogo from "./TeamLogo";
import { supabase } from "../lib/supabase";

type OfficialPost = {
  id: string;
  team_id: string;
  body: string;
  created_at: string;
  teams?: { name: string; logo_url: string | null; logo_bg: string | null } | null;
};

export default function TeamOfficialUpdates({ teamId }: { teamId?: string }) {
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
    <p className="eyebrow">OFFICIAL TEAM UPDATES</p>
    <h2>From the clubs</h2>
    <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
      {posts.map(post => <article key={post.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
        <Link href={"/teams/" + post.team_id} style={{ display: "inline-flex", alignItems: "center", gap: 9, fontWeight: 800 }}>
          {post.teams && <TeamLogo name={post.teams.name} logoUrl={post.teams.logo_url} logoBg={post.teams.logo_bg as any} size={30} />}
          {post.teams?.name || "Official team"}
          <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: ".08em", color: "var(--orange)", border: "1px solid var(--orange)", borderRadius: 999, padding: "3px 7px" }}>OFFICIAL</span>
        </Link>
        {post.image_url && <img src={post.image_url} alt={"Official update from " + (post.teams?.name || "team")} loading="lazy" style={{ display: "block", width: "100%", maxHeight: 420, objectFit: "cover", borderRadius: 12, marginTop: 12 }} />}\n        <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{post.body}</p>
        <small className="muted">{new Date(post.created_at).toLocaleString()}</small>
      </article>)}
    </div>
  </section>;
}
