"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import HoopLoading from "../../components/HoopLoading";
import TeamLeaguePicker from "../../components/TeamLeaguePicker";
import ProfileAvatar from "../../components/ProfileAvatar";
import { HoopIcon } from "../../components/HoopCheckUI";
import "./complete-profile.css";
import { supabase } from "../../lib/supabase";
import { getPlayerProfileCompletion, PLAYER_PROFILE_COMPLETION_FIELDS, type PlayerProfileCompletionRecord } from "../../lib/player-profile-completion";

type PlayerRecord = PlayerProfileCompletionRecord & {
  id: string;
  basketball_type?: "mens" | "womens" | null;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  position: string | null;
  current_team: string | null;
  current_country: string | null;
  favorite_leagues: string | null;
  height: string | null;
  bio: string | null;
  hometown: string | null;
  profile_visibility: string;
};

type FieldKey = (typeof PLAYER_PROFILE_COMPLETION_FIELDS)[number]["key"];

const fieldCopy: Record<FieldKey, { label: string; hint: string; placeholder: string }> = {
  photo: { label: "Profile photo", hint: "Add a clear photo so teams and players can recognise you.", placeholder: "Choose a photo" },
  position: { label: "Playing position", hint: "Enter your primary basketball position.", placeholder: "e.g. Point Guard" },
  current_team: { label: "Current team", hint: "Select your current team or mark yourself as a free agent.", placeholder: "e.g. BC Sumgait" },
  league_country: { label: "League / country", hint: "Enter your current country and, optionally, league separated by a dot.", placeholder: "e.g. Azerbaijan · ABL" },
  height: { label: "Height", hint: "Use feet/inches or centimetres.", placeholder: "e.g. 6'4\" or 193 cm" },
  bio: { label: "Player bio", hint: "Share a short professional basketball background.", placeholder: "A short summary of your playing career..." },
  location: { label: "Location", hint: "Enter your current city or home base.", placeholder: "e.g. Sumgait" },
};

export default function CompleteProfilePage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<PlayerRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeField, setActiveField] = useState<FieldKey | null>(null);
  const [value, setValue] = useState("");
  const [freeAgent, setFreeAgent] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/login?returnTo=/complete-profile"); setLoading(false); return; }
    setUserId(user.id);
    const { data, error: loadError } = await supabase.from("profiles")
      .select("id,account_type,basketball_type,display_name,username,avatar_url,position,current_team,free_agent,current_country,favorite_leagues,height,bio,hometown,profile_visibility")
      .eq("id", user.id).maybeSingle();
    if (loadError) { setError("Unable to load your profile: " + loadError.message); setLoading(false); return; }
    if (!data || data.account_type !== "player") { setError("The player profile checklist is available to player accounts."); setLoading(false); return; }
    setProfile(data as PlayerRecord);
    setLoading(false);
  }, [router]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  const completion = useMemo(() => getPlayerProfileCompletion(profile), [profile]);
  const displayName = profile?.display_name || profile?.username || "Player";

  function openField(key: FieldKey) {
    if (!profile) return;
    setError("");
    setNotice("");
    setActiveField(key);
    setPhoto(null);
    setFreeAgent(Boolean(profile.free_agent));
    if (key === "position") setValue(profile.position || "");
    else if (key === "current_team") setValue(profile.current_team || "");
    else if (key === "league_country") setValue([profile.current_country, profile.favorite_leagues].filter(Boolean).join(" · "));
    else if (key === "height") setValue(profile.height || "");
    else if (key === "bio") setValue(profile.bio || "");
    else if (key === "location") setValue(profile.hometown || "");
    else setValue("");
  }

  async function saveField() {
    if (!profile || !userId || !activeField || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      let updates: Record<string, string | boolean | null> = {};
      if (activeField === "photo") {
        if (!photo) throw new Error("Choose a photo before saving.");
        if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type)) throw new Error("Choose a valid image file.");
        if (photo.size > 10 * 1024 * 1024) throw new Error("Photo must be 10 MB or smaller.");
        const path = userId + "/profile-" + Date.now() + "-" + photo.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const { error: uploadError } = await supabase.storage.from("profile-avatars").upload(path, photo, { upsert: false, contentType: photo.type, cacheControl: "31536000" });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("profile-avatars").getPublicUrl(path);
        updates = { avatar_url: data.publicUrl + "?v=" + Date.now() };
      } else if (activeField === "position") updates = { position: value.trim() || null };
      else if (activeField === "current_team") updates = { current_team: freeAgent ? null : value.trim() || null, free_agent: freeAgent };
      else if (activeField === "league_country") {
        const parts = value.split(/[·|/]/).map(part => part.trim()).filter(Boolean);
        updates = { current_country: parts[0] || null, favorite_leagues: parts.slice(1).join(" · ") || null };
      } else if (activeField === "height") updates = { height: value.trim() || null };
      else if (activeField === "bio") updates = { bio: value.trim().slice(0, 500) || null };
      else if (activeField === "location") updates = { hometown: value.trim() || null };

      const { data, error: saveError } = await supabase.from("profiles").update(updates)
        .eq("id", userId)
        .select("id,account_type,basketball_type,display_name,username,avatar_url,position,current_team,free_agent,current_country,favorite_leagues,height,bio,hometown,profile_visibility")
        .maybeSingle();
      if (saveError) throw saveError;
      if (!data) throw new Error("No profile row was updated. Refresh and sign in again, then retry.");
      setProfile(data as PlayerRecord);
      setActiveField(null);
      setPhoto(null);
      setNotice(fieldCopy[activeField].label + " saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your changes could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function makePublic() {
    if (!profile || completion.percentage !== 100 || saving) return;
    setSaving(true);
    setError("");
    try {
      const { data, error: updateError } = await supabase.from("profiles").update({ profile_visibility: "public" })
        .eq("id", userId).select("id,account_type,basketball_type,display_name,username,avatar_url,position,current_team,free_agent,current_country,favorite_leagues,height,bio,hometown,profile_visibility").maybeSingle();
      if (updateError) throw updateError;
      if (!data) throw new Error("Your profile could not be made public. Please try again.");
      setProfile(data as PlayerRecord);
      router.push("/players/" + encodeURIComponent(userId));
    } catch (cause) {
      console.error("Publishing player profile failed:", cause);
      setError(cause instanceof Error ? cause.message : "Your profile could not be made public. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="page-shell"><div className="page-container"><HoopLoading label="Loading your profile checklist..." /></div></main>;

  return (
    <main className="page-shell hc-ux2b-page">
      <div className="page-container">
        <Link href="/account" className="hc-ux2b-back">← Account</Link>
        <header className="hc-ux2b-header">
          <ProfileAvatar name={displayName} src={profile?.avatar_url} size={64} />
          <div><p className="eyebrow">PLAYER PROFILE</p><h1>Complete your profile</h1><p className="muted">Every saved detail updates your progress immediately.</p></div>
        </header>
        {error && <p className="hc-ux2b-error" role="alert">{error}</p>}
        {notice && <p className="hc-ux2b-notice" role="status">{notice}</p>}
        {profile ? <>
          <section className="hc-ux2b-progress-card">
            <div className="hc-ux2b-progress-top"><strong>{completion.percentage}% complete</strong><span>{completion.completed} / {completion.total} details</span></div>
            <div className="hc-ux2b-progress" role="progressbar" aria-label="Player profile completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion.percentage}><span style={{ width: completion.percentage + "%" }} /></div>
          </section>
          <section className="hc-ux2b-checklist" aria-label="Profile completion checklist">
            {PLAYER_PROFILE_COMPLETION_FIELDS.map((field, index) => {
              const done = !completion.missing.includes(field.key);
              const isActive = activeField === field.key;
              const copy = fieldCopy[field.key];
              return <article className={"hc-ux2b-check-row" + (done ? " is-done" : "")} key={field.key}>
                <button type="button" className="hc-ux2b-check-trigger" onClick={() => openField(field.key)}>
                  <span className="hc-ux2b-check-number">{done ? "✓" : String(index + 1).padStart(2, "0")}</span>
                  <span><strong>{copy.label}</strong><small>{done ? "Completed" : "Tap to add this detail"}</small></span>
                  <HoopIcon name="chevron-right" size={18} />
                </button>
                {isActive && <div className="hc-ux2b-editor">
                  <p className="muted">{copy.hint}</p>
                  {field.key === "photo" ? <label className="hc-ux2b-file"><span>{photo?.name || copy.placeholder}</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => setPhoto(event.target.files?.[0] || null)} /></label> :
                    field.key === "current_team" ? <><label><input type="checkbox" checked={freeAgent} onChange={event => setFreeAgent(event.target.checked)} /> Free agent</label>{!freeAgent && <TeamLeaguePicker mode="team" label="Current team" returnValue="name" value={value} onChange={setValue} basketballType={profile.basketball_type || "mens"} directorySource={profile.basketball_type === "womens" ? "womens_teams" : "teams"} placeholder="Search and select your current team" />}</> :
                    field.key === "position" ? <select aria-label={copy.label} value={value} onChange={event => setValue(event.target.value)}><option value="">Choose position</option>{value && !["PG", "SG", "SF", "PF", "C"].includes(value) && <option value={value}>{value} (current)</option>}<option value="PG">Point Guard (PG)</option><option value="SG">Shooting Guard (SG)</option><option value="SF">Small Forward (SF)</option><option value="PF">Power Forward (PF)</option><option value="C">Center (C)</option></select> :
                    field.key === "bio" ? <textarea value={value} onChange={event => setValue(event.target.value)} maxLength={500} rows={4} placeholder={copy.placeholder} /> :
                    <input value={value} onChange={event => setValue(event.target.value)} maxLength={field.key === "height" ? 24 : 160} placeholder={copy.placeholder} />}
                  <div className="hc-ux2b-editor-actions"><button type="button" className="btn" disabled={saving || (field.key === "photo" && !photo)} onClick={() => void saveField()}>{saving ? "Saving..." : "Save detail"}</button><button type="button" className="btn dark" disabled={saving} onClick={() => setActiveField(null)}>Cancel</button></div>
                </div>}
              </article>;
            })}
          </section>
          {completion.percentage === 100 && <section className="hc-ux2b-complete-state"><span className="eyebrow">ALL SEVEN COMPLETE</span><h2>Your player profile is ready.</h2>{profile.profile_visibility === "public" ? <Link href={"/players/" + encodeURIComponent(userId)} className="btn">View Public Profile <HoopIcon name="arrow-up-right" size={16} /></Link> : <button type="button" className="btn" disabled={saving} onClick={() => void makePublic()}>{saving ? "Publishing..." : "Make Public"} <HoopIcon name="arrow-right" size={16} /></button>}</section>}
        </> : <section className="dashboard-card"><h2>Profile unavailable</h2><p className="muted">We couldn't load the player profile.</p><Link href="/account" className="btn dark">Return to Account</Link></section>}
      </div>
    </main>
  );
}
