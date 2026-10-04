"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type Review = {
  id: string; status: string; title: string | null; body: string;
  overall_rating: number; created_at: string;
  coach_id: string | null; team_id: string | null; league_id: string | null;
};
type Target = { id: string; name: string };

export default function AccountPage() {
  const [email, setEmail] = useState("");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [targets, setTargets] = useState<Record<string, Target>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      setEmail(user.email ?? "");
      const { data } = await supabase.from("reviews")
        .select("id,status,title,body,overall_rating,created_at,coach_id,team_id,league_id")
        .eq("author_id", user.id).order("created_at", { ascending: false });
      const rows = data ?? [];
      setReviews(rows);
      const ids = {
        coaches: rows.flatMap(r => r.coach_id ? [r.coach_id] : []),
        teams: rows.flatMap(r => r.team_id ? [r.team_id] : []),
        leagues: rows.flatMap(r => r.league_id ? [r.league_id] : [])
      };
      const [c,t,l] = await Promise.all([
        ids.coaches.length ? supabase.from("coaches").select("id,name").in("id", ids.coaches) : Promise.resolve({data:[]}),
        ids.teams.length ? supabase.from("teams").select("id,name").in("id", ids.teams) : Promise.resolve({data:[]}),
        ids.leagues.length ? supabase.from("leagues").select("id,name").in("id", ids.leagues) : Promise.resolve({data:[]})
      ]);
      const map: Record<string, Target> = {};
      for (const x of [...(c.data ?? []), ...(t.data ?? []), ...(l.data ?? [])]) map[x.id] = x;
      setTargets(map); setLoading(false);
    }
    load();
  }, []);

  if (loading) return <main className="page-shell"><div className="page-container"><p>Loading your account...</p></div></main>;

  return (
    <main className="page-shell"><div className="page-container">
      <header className="topbar">
        <Link href="/" className="brand">HOOPCHECK</Link>
        <nav className="topnav"><Link href="/dashboard">Dashboard</Link><Link href="/membership">Membership</Link></nav>
      </header>
      <section className="hero-card">
        <div><p className="eyebrow">MY ACCOUNT</p><h1>{email}</h1><p className="muted">Manage your HoopCheck activity and submitted reviews.</p></div>
      </section>
      <section style={{marginTop:32}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,marginBottom:18}}>
          <div><p className="eyebrow">REVIEW HISTORY</p><h2>My Reviews</h2></div>
          <Link href="/search" className="btn">Find Another</Link>
        </div>
        {!reviews.length ? <div className="dashboard-card"><h2>No reviews yet.</h2><p>Share your experience to help the next player make a better decision.</p></div> :
          <div style={{display:"grid",gap:16}}>{reviews.map(review => {
            const targetId = review.coach_id ?? review.team_id ?? review.league_id ?? "";
            const target = targets[targetId];
            const href = review.coach_id ? "/coaches/"+targetId : review.team_id ? "/teams/"+targetId : "/leagues/"+targetId;
            return <article key={review.id} className="dashboard-card">
              <div style={{display:"flex",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
                <div><span className="card-kicker">{review.coach_id ? "COACH" : review.team_id ? "TEAM" : "LEAGUE"}</span><h2>{target?.name ?? "Directory entry"}</h2></div>
                <strong>{review.status.toUpperCase()}</strong>
              </div>
              {review.title && <h3>{review.title}</h3>}
              <p>{review.body}</p>
              <p className="muted">Overall: {review.overall_rating}/5 · {new Date(review.created_at).toLocaleDateString()}</p>
              <Link href={href} className="btn dark">View Profile</Link>
            </article>;
          })}</div>}
      </section>
    </div></main>
  );
}
