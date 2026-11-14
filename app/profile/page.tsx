"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SocialProfileHeader, { profileCover } from "../../components/SocialProfileHeader";
import OwnProfilePostsGrid from "../../components/OwnProfilePostsGrid";
import { getCachedSession, supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import { HoopIcon, VerifiedBadge } from "../../components/HoopCheckUI";
import Surface from "../../components/Surface";
import HoopPassport from "../../components/HoopPassport";
import { useLanguage } from "../../components/LanguageProvider";
import { calculateProfileCompletion } from "../../lib/profile-completion";
import PlayerProfileCompletionCard from "../../components/PlayerProfileCompletionCard";

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
  const [cover, setCover] = useState(profileCover(null));
  const [loading, setLoading] = useState(true);
  const [postingStreak, setPostingStreak] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    (async () => {
      const { data: { session } } = await getCachedSession();
      const user = session?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      if (!active) return;
      setCover(profileCover(user.user_metadata?.hoopcheck_profile_cover));
      const result = await Promise.race([
        supabase
          .from("profiles")
          .select("id,display_name,username,first_name,last_name,account_type,bio,position,years_pro,current_country,current_team,height,player_verified,coach_verified,avatar_url,avatar_moderation_status,basketball_type,free_agent,hometown,nationality,interests,favorite_leagues,profile_visibility")
          .eq("id", user.id)
          .maybeSingle(),
        new Promise<any>((resolve) => setTimeout(() => resolve({ data: null, error: new Error("Profile request timed out") }), 8000)),
      ]);
      if (!active) return;
      if (result.error) { setLoadError(true); setLoading(false); return; }
      setP(result.data);
      if (result.data) {
        const { data: activity } = await supabase.from("feed_posting_activity").select("activity_date").eq("user_id", user.id).order("activity_date", { ascending: false }).limit(370);
        if (!active) return;
        setPostingStreak(calculatePostingStreak(activity || []));
      }
      setLoading(false);
    })().catch(() => { if (active) { setLoadError(true); setLoading(false); } });
    return () => { active = false; };
  }, [retryKey]);

  if (loading) {
    return (
      <main className="page-shell hc-member-profile-page">
        <div className="page-container">
          <HoopLoading label={t("loading")} />
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
            {loadError ? <p role="alert">Your profile could not be loaded. Please try again.</p> : null}
            {loadError ? <button type="button" className="btn" onClick={() => setRetryKey(v => v + 1)}>Retry profile</button> : <Link href="/account" className="btn">{t("editAccount")}</Link>}
          </section>
        </div>
      </main>
    );
  }

  const name = p.display_name || p.username || "HoopCheck Member";
  const completion = calculateProfileCompletion(p);
  const profileCompletion = completion.percentage;
  const firstMissingField = completion.nextMissing?.label ?? "profile details";
  const nextFieldAnchor = completion.nextMissing?.key ?? "profile-editor";

  return (
    <main className="page-shell hc-member-profile-page">
      <div className="page-container">
        <SocialProfileHeader name={name} handle={p.username} avatarUrl={p.avatar_url} cover={cover}
          badge={(p.player_verified || p.coach_verified) && <VerifiedBadge label={p.player_verified ? "Verified player" : "Verified coach"} />}
          actions={<Link href="/account#profile-editor" className="btn">{t("editProfile")}</Link>}>
          {p.avatar_url && p.avatar_moderation_status === "pending" && <p className="muted">{t("photoReview")}</p>}
          {p.bio && <p className="hc-social-bio">{p.bio}</p>}
          {postingStreak > 0 && <p className="hc-social-streak"><span aria-hidden="true">🔥</span> {postingStreak}-day streak</p>}
        </SocialProfileHeader>
        <nav className="hc-social-profile-nav" aria-label="Profile sections">
          <a href="#profile-about">About</a>
          {p.account_type === "player" && <a href="#profile-posts">Posts</a>}
          <a href="#career-passport">Career Passport</a>
          <Link href="/account#profile-appearance">Customize</Link>
          {p.account_type === "player" && (p.profile_visibility === "public"
            ? <Link href={"/players/" + encodeURIComponent(p.id)}>{t("profilePublic")}</Link>
            : <Link href="/account#visibility">{t("editVisibility")}</Link>)}
          {p.account_type === "player" && <Link href="/account#team-review-checklist">Team review checklist</Link>}
        </nav>
          {p.account_type === "player" ? <PlayerProfileCompletionCard profile={p} onPublished={() => setP((current: any) => ({ ...current, profile_visibility: "public" }))} /> : profileCompletion < 100 && <div className="hc-profile-completion">
            <div className="hc-profile-completion-copy"><strong>Profile {profileCompletion}% complete</strong><span>— add your {firstMissingField}</span><Link href={"/account#profile-editor-field-" + nextFieldAnchor}>Complete profile <span aria-hidden="true">→</span></Link></div>
            <div className="hc-profile-completion-track" role="progressbar" aria-label={t("profileCompleteness")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={profileCompletion}><span style={{width: profileCompletion + "%"}} /></div>
          </div>}
        <div id="career-passport" style={{ scrollMarginTop: 96 }}><HoopPassport name={name} accountType={p.account_type||"member"} username={p.username} verified={Boolean(p.player_verified||p.coach_verified)} country={p.current_country} position={p.account_type==="player"?p.position:null} team={p.account_type==="player"?p.current_team:null}/></div>
        <nav className="hc-profile-action-hub" aria-label="Profile quick links">
          <Link href="/membership" className="hc-profile-membership-link"><HoopIcon name="star" size={20} /><span>Membership &amp; Perks</span><HoopIcon name="chevron-right" size={18} /></Link>
          <div className="hc-profile-quick-grid">
            <Link href="/settings" className="hc-profile-quick-link"><HoopIcon name="settings" size={22} /><span>Settings</span></Link>
            <Link href="/notifications" className="hc-profile-quick-link"><HoopIcon name="bell" size={22} /><span>Alerts</span></Link>
            <Link href="/search" className="hc-profile-quick-link"><HoopIcon name="search" size={22} /><span>Search</span></Link>
            <Link href={p.account_type === "fan" ? "/fan-feed" : p.account_type === "agent" || p.account_type === "scout" ? "/agents-hq" : p.account_type === "coach" ? "/coach-placement" : p.account_type === "manager" || p.account_type === "club_admin" ? "/team-dashboard" : "/pre-sign"} className="hc-profile-quick-link"><HoopIcon name={p.account_type === "player" ? "clipboard-check" : "users"} size={22} /><span>{p.account_type === "fan" ? "Fan HQ" : p.account_type === "agent" || p.account_type === "scout" ? "Agents HQ" : p.account_type === "coach" ? "Coach Placement" : p.account_type === "manager" || p.account_type === "club_admin" ? "Team HQ" : "Pre-Sign"}</span></Link>
          </div>
        </nav>

        <Surface as="section" className="hc-profile-summary" id="profile-about" aria-label={t("profileOverview")}>
          <dl>
            <div><dt>{t("basketball")}</dt><dd>{p.basketball_type === "womens" ? t("womensBasketball") : p.basketball_type === "mens" ? t("mensBasketball") : t(p.account_type)}</dd></div>
            {p.account_type === "player" && (p.position || p.current_team || p.free_agent) &&
              <div><dt>{t("career")}</dt><dd>{[p.position, p.free_agent ? t("freeAgent") : p.current_team].filter(Boolean).join(" · ")}</dd></div>}
            <div><dt>{t("location")}</dt><dd>{[p.hometown, p.current_country || p.nationality].filter(Boolean).join(", ") ||
              <Link href="/account#profile-editor">{t("add")}</Link>}</dd></div>
          </dl>
          {p.interests && <p><strong>{t("interests")}</strong> {p.interests}</p>}
          {p.favorite_leagues && <p><strong>{t("favoriteLeagues")}</strong> {p.favorite_leagues}</p>}
        </Surface>

        {p.account_type === "player" && <div id="profile-posts"><OwnProfilePostsGrid userId={p.id} /></div>}

        <section className="dashboard-card compact-section">
          <p className="eyebrow">{t("account")}</p>
          <h2>{t("accountControls")}</h2>
          <p className="muted">{t("hideProfileOrDelete")}</p>
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
            }}>{t("deactivateAccount")}</button>
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
            }}>{t("deleteAccount")}</button>
          </div>
        </section>


      </div>
    </main>
  );
}
