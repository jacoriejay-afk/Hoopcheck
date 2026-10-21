"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCachedSession, supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import { HoopIcon, VerifiedBadge } from "../../components/HoopCheckUI";

function calculatePostingStreak(rows: { activity_date: string }[]) {
  const dates = new Set(rows.map(row => String(row.activity_date).slice(0, 10)));
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let cursor = dates.has(today) ? today : dates.has(yesterday) ? yesterday : "";
  if (!cursor) return 0;
  let count = 0;
  while (dates.has(cursor)) {
    count += 1;
    cursor = new Date(Date.parse(cursor + "T00:00:00.000Z") - 86400000).toISOString().slice(0, 10);
  }
  return count;
}

export default function ProfilePage() {
  const [p, setP] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await getCachedSession();
      const user = session?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      setEmail(user.email || "");
      const result = await Promise.race([
        supabase
          .from("profiles")
          .select("id,display_name,username,first_name,last_name,account_type,bio,position,years_pro,current_country,current_team,player_verified,coach_verified,avatar_url,basketball_type,free_agent,hometown,nationality,interests,favorite_leagues,profile_visibility")
          .eq("id", user.id)
          .maybeSingle(),
        new Promise<any>((resolve) => setTimeout(() => resolve({ data: null }), 2500)),
      ]);
      setP(result.data);
      if (result.data?.account_type === "player") {
        const { data: activity } = await supabase.from("feed_posting_activity").select("activity_date").eq("user_id", user.id).order("activity_date", { ascending: false }).limit(370);
        setPostingStreak(calculatePostingStreak(activity || []));
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <main className="page-shell hc-member-profile-page">
        <div className="page-container">
          <HoopLoading label="Loading your profile..." />
        </div>
      </main>
    );
  }

  if (!p) {
    return (
      <main className="page-shell hc-member-profile-page">
        <div className="page-container">
          <section className="hero-card">
            <h1>Profile unavailable</h1>
            <Link href="/account" className="btn">Edit Account</Link>
          </section>
        </div>
      </main>
    );
  }

  const name = p.display_name || p.username || "HoopCheck Member";
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part: string) => part[0]).join("").toUpperCase() || "HC";

  return (
    <main className="page-shell hc-member-profile-page">
      <div className="page-container">
        <section className="hero-card compact-hero" aria-labelledby="hc-member-profile-title">
          <div className="hc-member-profile-identity">
            <div className="hc-member-profile-avatar">
              {p.avatar_url ? <img src={p.avatar_url} alt="" /> : <span>{initials}</span>}
            </div>
            <div className="hc-member-profile-copy">
              <p className="eyebrow">MY PROFILE</p>
              <h1 id="hc-member-profile-title">
                {name}
                {(p.player_verified || p.coach_verified) && <VerifiedBadge label={p.player_verified ? "Verified player" : "Verified coach"} />}
              </h1>
              <p className="muted hc-profile-email">{email}</p>
              {p.account_type === "player" && <span className="hc-feed-streak" aria-label={postingStreak + " day HoopFeed posting streak"}><span aria-hidden="true">🔥</span> {postingStreak}-day streak</span>}
            </div>
          </div>

          <div className="hc-member-profile-actions">
            <Link href="/account" className="btn">Edit Profile</Link>
            {p.account_type === "player" && (
              <Link href={"/players/" + p.id} className="btn dark">
                View Public Profile <HoopIcon name="arrow-up-right" size={16} />
              </Link>
            )}
          </div>
        </section>

        <section className="grid compact-grid" aria-label="Profile overview">
          <article className="card">
            <span className="card-kicker">BASKETBALL</span>
            <h2>{p.basketball_type === "womens" ? "Women’s Basketball" : "Men’s Basketball"}</h2>
            <p className="muted">{p.account_type}</p>
          </article>
          {p.account_type === "player" && (
            <article className="card">
              <span className="card-kicker">CAREER</span>
              <h2>{p.position || "Position not listed"}</h2>
              <p className="muted">
                {p.years_pro == null ? "Years pro not listed" : p.years_pro + " years pro"}
                {" · "}
                {p.free_agent ? "Free Agent" : p.current_team || "Team not listed"}
              </p>
            </article>
          )}
          <article className="card">
            <span className="card-kicker">LOCATION</span>
            <h2>{p.current_country || "Not listed"}</h2>
            <p className="muted">{p.hometown || p.nationality || "Location details not listed"}</p>
          </article>
        </section>

        <section className="dashboard-card compact-section">
          <p className="eyebrow">ABOUT</p>
          <h2>Profile details</h2>
          <p className="muted">{p.bio || "Add a bio from Edit Profile."}</p>
          {p.interests && <p><strong>Interests:</strong> {p.interests}</p>}
          {p.favorite_leagues && <p><strong>Favorite leagues:</strong> {p.favorite_leagues}</p>}
        </section>

        <section className="dashboard-card compact-section">
          <p className="eyebrow">ACCOUNT</p>
          <h2>Account controls</h2>
          <p className="muted">Sign out, hide your profile, or permanently delete your HoopCheck account.</p>
          <div className="actions">
            <button type="button" className="btn dark" onClick={async () => {
              await supabase.auth.signOut();
              window.location.replace("/login");
            }}>Sign Out</button>
            <button type="button" className="btn" onClick={async () => {
              if (!window.confirm("Deactivate your account profile? This will hide your profile from public HoopCheck listings and sign you out.")) return;
              const res = await fetch("/api/account/deactivate", { method: "POST" });
              const body = await res.json().catch(() => ({}));
              if (!res.ok) {
                window.alert(body.error || "Unable to deactivate account.");
                return;
              }
              await supabase.auth.signOut();
              window.location.replace("/login");
            }}>Deactivate Account</button>
            <button type="button" className="btn hc-danger-button" onClick={async () => {
              if (!window.confirm("Delete your HoopCheck account permanently? This cannot be undone.")) return;
              const res = await fetch("/api/account/delete", { method: "POST" });
              const body = await res.json().catch(() => ({}));
              if (!res.ok) {
                window.alert(body.error || "Unable to delete account.");
                return;
              }
              await supabase.auth.signOut();
              window.location.replace("/");
            }}>Delete Account</button>
          </div>
        </section>

        <div className="bottom-back">
          <button type="button" className="btn dark" onClick={() => window.history.back()}>
            <HoopIcon name="arrow-right" size={16} style={{ transform: "rotate(180deg)" }} /> Back
          </button>
        </div>
      </div>
    </main>
  );
}
