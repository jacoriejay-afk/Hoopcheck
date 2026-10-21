"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCachedSession, supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import { HoopIcon, VerifiedBadge } from "../../components/HoopCheckUI";
import { useLanguage } from "../../components/LanguageProvider";

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
  const { t } = useLanguage();
  const [p, setP] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [postingStreak, setPostingStreak] = useState(0);

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
          .select("id,display_name,username,first_name,last_name,account_type,bio,position,years_pro,current_country,current_team,player_verified,coach_verified,avatar_url,avatar_moderation_status,basketball_type,free_agent,hometown,nationality,interests,favorite_leagues,profile_visibility")
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
            <h1>{t("profileUnavailable")}</h1>
            <Link href="/account" className="btn">Edit Account</Link>
          </section>
        </div>
      </main>
    );
  }

  const name = p.display_name || p.username || "HoopCheck Member";
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part: string) => part[0]).join("").toUpperCase() || "HC";
  const profileFields = [p.display_name || p.username, p.bio, p.position, p.years_pro != null ? String(p.years_pro) : "", p.current_country, p.current_team, p.avatar_url, p.hometown || p.nationality];
  const profileCompletion = Math.round((profileFields.filter(Boolean).length / profileFields.length) * 100);
  const firstMissingField = !p.position ? "position" : !p.current_country ? "location" : !p.bio ? "bio" : "profile details";

  return (
    <main className="page-shell hc-member-profile-page">
      <div className="page-container">
        <section className="hero-card compact-hero" aria-labelledby="hc-member-profile-title">
          <div className="hc-member-profile-identity">
            <div className="hc-member-profile-avatar-wrap">
              <div className="hc-member-profile-avatar">
                {p.avatar_url ? <img src={p.avatar_url} alt={name + " profile photo"} /> : <span>{initials}</span>}
              </div>
              {p.avatar_url && p.avatar_moderation_status === "pending" && <span className="hc-profile-photo-state">Photo review</span>}
            </div>
            <div className="hc-member-profile-copy">
              <p className="eyebrow">{t("profile")}</p>
              <h1 id="hc-member-profile-title">
                <span>{name}</span>
                {(p.player_verified || p.coach_verified) && <VerifiedBadge label={p.player_verified ? "Verified player" : "Verified coach"} />}
              </h1>
              <p className="muted hc-profile-email">{p.username ? "@" + p.username + (email ? " · " + email : "") : email}</p>
            </div>
          </div>

          <div className="hc-member-profile-actions">
            <Link href="/account#profile-editor" className="btn hc-profile-edit-button">{t("editProfile")}</Link>
            {p.account_type === "player" && (p.profile_visibility === "public" ? (
              <Link href={"/players/" + encodeURIComponent(p.id)} className="btn dark hc-profile-public-button">
                <span className="hc-profile-public-full">View Public Profile</span><span className="hc-profile-public-short">Public Profile</span><HoopIcon name="arrow-up-right" size={16} />
              </Link>
            ) : (
              <Link href="/account#profile-editor" className="btn dark hc-profile-public-button">
                <span>Profile Is Not Public</span><HoopIcon name="arrow-up-right" size={16} />
              </Link>
            ))}
          </div>
          {p.account_type === "player" && postingStreak > 0 && <div className="hc-profile-streak-row"><span className="hc-feed-streak" aria-label={postingStreak + " day HoopFeed posting streak"}><span aria-hidden="true">🔥</span> {postingStreak}-day streak</span></div>}

        </section>

        <section className="hc-profile-overview" aria-label="Profile overview">
          {profileCompletion < 100 && <div className="hc-profile-completion">
            <div className="hc-profile-completion-copy"><strong>Profile {profileCompletion}% complete</strong><span>— add your {firstMissingField}</span><Link href="/account#profile-editor">Complete profile <span aria-hidden="true">→</span></Link></div>
            <div className="hc-profile-completion-track" role="progressbar" aria-label="Profile completeness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={profileCompletion}><span style={{width: profileCompletion + "%"}} /></div>
          </div>}
          <div className="grid compact-grid">
            <article className="card hc-profile-info-card">
              <span className="card-kicker">{t("teams")}</span>
              <h2>{p.basketball_type === "womens" ? "Women’s Basketball" : "Men’s Basketball"}</h2>
              <p className="muted">{p.account_type}</p>
            </article>
            {p.account_type === "player" && (
              <article className="card hc-profile-info-card">
                <span className="card-kicker">CAREER</span>
                {p.position ? <h2>{p.position}</h2> : <p className="hc-profile-empty-value">Position not listed <Link href="/account#profile-editor">Add <span aria-hidden="true">→</span></Link></p>}
                <p className="muted">{p.years_pro == null ? "Years pro not listed" : p.years_pro + " years pro"}{" · "}{p.free_agent ? "Free Agent" : p.current_team || "Team not listed"}</p>
              </article>
            )}
            <article className="card hc-profile-info-card">
              <span className="card-kicker">LOCATION</span>
              {p.current_country ? <h2>{p.current_country}</h2> : <p className="hc-profile-empty-value">Not listed <Link href="/account#profile-editor">Add <span aria-hidden="true">→</span></Link></p>}
              <p className="muted">{p.hometown || p.nationality || "Location details not listed"}</p>
            </article>
          </div>
        </section>

        <section className="dashboard-card compact-section">
          <p className="eyebrow">{t("profileDetails")}</p>
          <h2>{t("profileDetails")}</h2>
          <p className="muted">{p.bio || "Add a bio from Edit Profile."}</p>
          {p.interests && <p><strong>Interests:</strong> {p.interests}</p>}
          {p.favorite_leagues && <p><strong>Favorite leagues:</strong> {p.favorite_leagues}</p>}
        </section>

        <section className="dashboard-card compact-section">
          <p className="eyebrow">{t("account")}</p>
          <h2>{t("accountControls")}</h2>
          <p className="muted">Sign out, hide your profile, or permanently delete your HoopCheck account.</p>
          <div className="actions">
            <button type="button" className="btn dark" onClick={async () => {
              await supabase.auth.signOut();
              window.location.replace("/login");
            }}>{t("signOut")}</button>
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
