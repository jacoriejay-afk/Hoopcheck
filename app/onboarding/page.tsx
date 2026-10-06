"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import HoopLoading from "../../components/HoopLoading";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [accountType, setAccountType] = useState<"player"|"coach"|"scout"|"agent"|"fan">("player");
  const [professionalExperience, setProfessionalExperience] = useState(false);
  const [formerTeams, setFormerTeams] = useState<string[]>([]);
  const [teams, setTeams] = useState<{id:string;name:string;country:string|null;league_name:string|null}[]>([]);
  const [position, setPosition] = useState("");
  const [yearsPro, setYearsPro] = useState("");
  const [country, setCountry] = useState("");
  const [currentCountry, setCurrentCountry] = useState("");
  const [currentTeam, setCurrentTeam] = useState("");
  const [bio, setBio] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [interests, setInterests] = useState("");
  const [experienceSummary, setExperienceSummary] = useState("");
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
        .select("id,display_name,username,first_name,last_name,account_type,professional_experience,position,years_pro,country,current_country,current_team,bio,profile_visibility,interests,experience_summary")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;
      setUserId(user.id);
      setDisplayName(profile?.display_name || user.user_metadata?.full_name || "");
      setUsername(profile?.username || user.user_metadata?.username || "");
      setFirstName(profile?.first_name || user.user_metadata?.first_name || "");
      setLastName(profile?.last_name || user.user_metadata?.last_name || "");
      setAccountType((profile?.account_type || user.user_metadata?.account_type || "player") as "player"|"coach"|"scout"|"agent"|"fan");
      setProfessionalExperience(profile?.professional_experience ?? Boolean(user.user_metadata?.professional_experience));
      const metadataTeams = Array.isArray(user.user_metadata?.former_team_ids) ? user.user_metadata.former_team_ids : [];
      setFormerTeams(metadataTeams);
      setPosition(profile?.position || "PG");
      setYearsPro(profile?.years_pro != null ? String(profile.years_pro) : "");
      setCountry(profile?.country || "");
      setCurrentCountry(profile?.current_country || "");
      setCurrentTeam(profile?.current_team || "");
      setBio(profile?.bio || "");
      setVisibility(profile?.profile_visibility || "public");
      setInterests(profile?.interests || user.user_metadata?.interests || "");
      setExperienceSummary(profile?.experience_summary || user.user_metadata?.experience_summary || "");
      const { data: teamRows } = await supabase.from("teams").select("id,name,country,league_name").eq("active", true).order("name").limit(300);
      setTeams(teamRows || []);
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
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        account_type: accountType,
        professional_experience: professionalExperience,
        display_name: displayName.trim() || "HoopCheck Player",
        position: position.trim() || null,
        years_pro: years,
        country: country.trim() || null,
        current_country: currentCountry.trim() || null,
        current_team: currentTeam.trim() || null,
        bio: bio.trim() || null,
        profile_visibility: visibility === "public" ? "public" : "private",
        interests: interests.trim().slice(0,500) || null,
        experience_summary: experienceSummary.trim().slice(0,700) || null,
      })
      .eq("id", userId);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    if (formerTeams.length) {
      const rows = formerTeams.map(team_id => ({ user_id: userId, team_id, relationship: "former", verified: false }));
      await supabase.from("player_team_affiliations").upsert(rows, { onConflict: "user_id,team_id", ignoreDuplicates: false });
    }
    setMessage("Profile saved. Welcome to HoopCheck.");
    setSaving(false);
    setTimeout(() => router.replace("/dashboard"), 500);
  }

  if (loading) {
    return <main style={{ padding: "80px 6%" }}><HoopLoading label="Loading your account..." /></main>;
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
            <label>Username</label>
            <input value={username} readOnly aria-readonly="true" />
            <p className="muted" style={{fontSize:12}}>Username is locked after account creation.</p>
            <label>First Name</label>
            <input value={firstName} readOnly aria-readonly="true" />
            <label>Last Name</label>
            <input value={lastName} readOnly aria-readonly="true" />
            <p className="muted" style={{fontSize:12}}>Your first and last name are locked after account setup.</p>
            <label>Account Type</label>
            <select value={accountType} onChange={e=>setAccountType(e.target.value as "player"|"scout"|"agent"|"fan")}>
              <option value="player">Player</option><option value="coach">Coach</option><option value="scout">Scout</option><option value="agent">Agent</option><option value="fan">Fan</option>
            </select>
            <p className="muted" style={{fontSize:12}}>Only verified players can write ratings or reviews. Scouts, agents, and fans remain research-only.</p>
            <label>Professional Experience</label>
            <select value={professionalExperience ? "yes" : "no"} onChange={e=>setProfessionalExperience(e.target.value==="yes")}>
              <option value="yes">Yes — professional player</option><option value="no">No — not yet</option>
            </select>

            <label htmlFor="position">Position</label>
            <select id="position" value={position || "PG"} onChange={e => setPosition(e.target.value)} disabled={accountType === "player"}><option value="PG">Point Guard (PG)</option><option value="SG">Shooting Guard (SG)</option><option value="SF">Small Forward (SF)</option><option value="PF">Power Forward (PF)</option><option value="C">Center (C)</option></select>
            {accountType === "player" && <p className="muted" style={{fontSize:12}}>Position is locked after account creation.</p>}

            <label htmlFor="yearsPro">Years Pro</label>
            <select id="yearsPro" value={yearsPro || "0"} onChange={e => setYearsPro(e.target.value)} disabled={accountType === "player"}>
              {Array.from({length:26},(_,i)=><option key={i} value={i}>{i === 0 ? "0 years" : i + " year" + (i===1 ? "" : "s")}</option>)}
            </select>
            <label>Teams you have played for</label>
            <p className="muted" style={{fontSize:12}}>These affiliations are saved for review eligibility. HoopCheck can verify them before you can review a team.</p>
            <div style={{maxHeight:240,overflow:"auto",display:"grid",gap:7,border:"1px solid var(--border)",padding:10,borderRadius:10}}>
              {teams.map(team=><label key={team.id} className="checkbox-row"><input type="checkbox" checked={formerTeams.includes(team.id)} onChange={e=>setFormerTeams(v=>e.target.checked?[...v,team.id]:v.filter(id=>id!==team.id))}/><span>{team.name}{team.league_name ? " — " + team.league_name : ""}</span></label>)}
            </div>

            <label htmlFor="country">Home Country</label>
            <input id="country" value={country} onChange={e => setCountry(e.target.value)} placeholder="United States" />

            <label htmlFor="currentCountry">Current Country</label>
            <input id="currentCountry" value={currentCountry} onChange={e => setCurrentCountry(e.target.value)} />

            <label htmlFor="currentTeam">Current Team</label>
            <input id="currentTeam" value={currentTeam} onChange={e => setCurrentTeam(e.target.value)} />

            <label htmlFor="interests">What do you want from HoopCheck?</label><textarea id="interests" value={interests} onChange={e=>setInterests(e.target.value)} rows={3} maxLength={500} placeholder="Research teams, follow leagues, find coaches, connect with players..." />
            <label htmlFor="experienceSummary">About yourself</label><textarea id="experienceSummary" value={experienceSummary} onChange={e=>setExperienceSummary(e.target.value)} rows={3} maxLength={700} placeholder="Optional background, goals, or basketball interests." />

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
