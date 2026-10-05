"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [position, setPosition] = useState("");
  const [yearsPro, setYearsPro] = useState("");
  const [country, setCountry] = useState("");
  const [currentCountry, setCurrentCountry] = useState("");
  const [currentTeam, setCurrentTeam] = useState("");
  const [bio, setBio] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.replace("/login");
        return;
      }
      const user = session.user;
      const { data: profile } = await supabase
        .from("profiles")
        .select("id,display_name,position,years_pro,country,current_country,current_team,bio,profile_visibility")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;
      setUserId(user.id);
      setDisplayName(profile?.display_name || user.user_metadata?.full_name || "");
      setPosition(profile?.position || "");
      setYearsPro(profile?.years_pro != null ? String(profile.years_pro) : "");
      setCountry(profile?.country || "");
      setCurrentCountry(profile?.current_country || "");
      setCurrentTeam(profile?.current_team || "");
      setBio(profile?.bio || "");
      setVisibility(profile?.profile_visibility || "public");
      setLoading(false);
    })();
    return () => { active = false; };
  }, [router]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const years = yearsPro.trim() ? Number(yearsPro) : null;
    if (years !== null && (!Number.isInteger(years) || years < 0 || years > 50)) {
      setError("Years pro must be a whole number from 0 to 50.");
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || "HoopCheck Player",
        position: position.trim() || null,
        years_pro: years,
        country: country.trim() || null,
        current_country: currentCountry.trim() || null,
        current_team: currentTeam.trim() || null,
        bio: bio.trim() || null,
        profile_visibility: visibility === "public" ? "public" : "private",
      })
      .eq("id", userId);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setMessage("Profile saved. Welcome to HoopCheck.");
    setSaving(false);
    setTimeout(() => router.replace("/dashboard"), 500);
  }

  if (loading) {
    return <main style={{ padding: "80px 6%" }}><p>Loading your account...</p></main>;
  }

  return (
    <main>
      <nav className="nav">
        <Link href="/" className="logo">Hoop<span>Check</span></Link>
        <div className="links"><button type="button" onClick={() => window.history.back()} style={{background:"transparent",border:"1px solid #333",color:"#fff",borderRadius:7,padding:"7px 10px",cursor:"pointer"}}>← Back</button><Link href="/dashboard">Dashboard</Link></div>
      </nav>

      <section className="auth-page">
        <div className="auth-hero">
          <div className="eyebrow">PHASE 2 · PLAYER ONBOARDING</div>
          <h1>Build your player profile.</h1>
          <p>
            Give other players enough context to know who they are hearing from.
            You can edit this anytime from Account.
          </p>
          <div className="feature-grid">
            <div className="feature"><strong>01</strong><span>Show your professional background.</span></div>
            <div className="feature"><strong>02</strong><span>Choose whether your profile is public.</span></div>
            <div className="feature"><strong>03</strong><span>Build trust with verification later.</span></div>
          </div>
        </div>

        <div className="auth-card">
          <div className="eyebrow">PLAYER PROFILE</div>
          <h2>Complete your profile.</h2>
          <form onSubmit={save}>
            <label htmlFor="displayName">Display Name</label>
            <input id="displayName" value={displayName} onChange={e => setDisplayName(e.target.value)} required />

            <label htmlFor="position">Position</label>
            <input id="position" value={position} onChange={e => setPosition(e.target.value)} placeholder="PG, SG, SF, PF, C" />

            <label htmlFor="yearsPro">Years Pro</label>
            <input id="yearsPro" type="number" min="0" max="50" value={yearsPro} onChange={e => setYearsPro(e.target.value)} />

            <label htmlFor="country">Home Country</label>
            <input id="country" value={country} onChange={e => setCountry(e.target.value)} placeholder="United States" />

            <label htmlFor="currentCountry">Current Country</label>
            <input id="currentCountry" value={currentCountry} onChange={e => setCurrentCountry(e.target.value)} />

            <label htmlFor="currentTeam">Current Team</label>
            <input id="currentTeam" value={currentTeam} onChange={e => setCurrentTeam(e.target.value)} />

            <label htmlFor="bio">Short Bio</label>
            <textarea id="bio" value={bio} onChange={e => setBio(e.target.value)} rows={5} maxLength={1200} />

            <label htmlFor="visibility">Profile Visibility</label>
            <select id="visibility" value={visibility} onChange={e => setVisibility(e.target.value)}>
              <option value="public">Public — searchable by players</option>
              <option value="private">Private</option>
            </select>

            {error && <div className="message error" role="alert">{error}</div>}
            {message && <div className="message success">{message}</div>}

            <button className="btn submit" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save & Continue"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
