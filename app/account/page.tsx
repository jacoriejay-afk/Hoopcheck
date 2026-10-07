"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import HoopLoading from "../../components/HoopLoading";
import { supabase } from "../../lib/supabase";

type Subscription = {
  plan: "pro" | "premium" | null;
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
};

type Profile = {
  account_type: "player"|"coach"|"scout"|"agent"|"fan";
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  professional_experience: boolean;
  bio: string | null;
  position: string | null;
  years_pro: number | null;
  current_country: string | null;
  current_team: string | null;
  profile_visibility: "public" | "private";
  player_verified: boolean; coach_verified?: boolean; coach_profile_id?: string | null; experience_summary?: string | null;
  profile_claimed: boolean;
  avatar_url: string | null;
  avatar_moderation_status: "pending" | "approved" | "rejected";
};
type Review = { id: string; status: string; title: string | null; body: string; overall_rating: number; created_at: string; coach_id: string | null; team_id: string | null; league_id: string | null; };
type Target = { id: string; name: string };

const emptyProfile: Profile = {
  account_type: "player",
  display_name: null, first_name: null, last_name: null, professional_experience: false,
  bio: null, position: null, years_pro: null, current_country: null, current_team: null,
  profile_visibility: "public", player_verified: false, profile_claimed: true,
  avatar_url: null, avatar_moderation_status: "approved"
};

export default function AccountPage() {
  const [email, setEmail] = useState("");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [targets, setTargets] = useState<Record<string, Target>>({});
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [verified, setVerified] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [position, setPosition] = useState("");
  const [yearsPro, setYearsPro] = useState("");
  const [currentCountry, setCurrentCountry] = useState("");
  const [currentTeam, setCurrentTeam] = useState("");
  const [hometown, setHometown] = useState("");
  const [nationality, setNationality] = useState("");
  const [interests, setInterests] = useState("");
  const [favoriteLeagues, setFavoriteLeagues] = useState("");
  const [coachingExperience, setCoachingExperience] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [freeAgent, setFreeAgent] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarStatus, setAvatarStatus] = useState<"pending"|"approved"|"rejected">("approved");
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropPreview, setCropPreview] = useState("");
  const [cropZoom, setCropZoom] = useState(1);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      setEmail(user.email ?? "");
      const [{ data: profileData }, { data: subscriptionData }] = await Promise.all([
        supabase.from("profiles").select("account_type,display_name,first_name,last_name,professional_experience,bio,position,years_pro,current_country,current_team,profile_visibility,player_verified,coach_verified,coach_profile_id,experience_summary,profile_claimed,avatar_url,avatar_moderation_status").eq("id", user.id).maybeSingle(),
        supabase.from("subscriptions").select("plan,status,current_period_end,cancel_at_period_end").eq("user_id", user.id).maybeSingle(),
      ]);
      const nextProfile: Profile = profileData
        ? { ...emptyProfile, ...profileData }
        : emptyProfile;
      setProfile(nextProfile);
      setDisplayName(nextProfile.display_name ?? "");
      setBio(nextProfile.bio ?? "");
      setPosition(nextProfile.position ?? "");
      setYearsPro(nextProfile.years_pro?.toString() ?? "");
      setCurrentCountry(nextProfile.current_country ?? "");
      setCurrentTeam(nextProfile.current_team ?? "");
      setHometown((nextProfile as any).hometown ?? "");
      setNationality((nextProfile as any).nationality ?? "");
      setFreeAgent(Boolean((nextProfile as any).free_agent));
      setInterests((nextProfile as any).interests ?? "");
      setFavoriteLeagues((nextProfile as any).favorite_leagues ?? "");
      setCoachingExperience((nextProfile as any).experience_summary ?? "");
      setVisibility(nextProfile.profile_visibility ?? "public");
      setAvatarUrl(nextProfile.avatar_url ?? "");
      setAvatarStatus(nextProfile.avatar_moderation_status ?? "approved");
      setSubscription(subscriptionData ?? null);
      setVerified(Boolean(nextProfile.player_verified || (nextProfile as any).coach_verified));
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

  function chooseAvatar(file: File) {
    if (!file.type.startsWith("image/")) { setProfileMessage("Please choose an image file."); return; }
    if (file.size > 10 * 1024 * 1024) { setProfileMessage("Profile photos must be 10MB or smaller."); return; }
    setCropFile(file);
    setCropPreview(URL.createObjectURL(file));
    setCropZoom(1);
    setProfileMessage("");
  }

  async function cropAndUploadAvatar() {
    if (!cropFile || !cropPreview) return;
    const image = new Image();
    image.src = cropPreview;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to read that image."));
    });

    const size = 720;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setProfileMessage("Your browser could not prepare the photo."); return; }

    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight) / cropZoom;
    const sx = Math.max(0, (image.naturalWidth - sourceSize) / 2);
    const sy = Math.max(0, (image.naturalHeight - sourceSize) / 2);
    ctx.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, size, size);

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) { setProfileMessage("Unable to prepare the cropped photo."); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const path = user.id + "/avatar.jpg";
    const { error: uploadError } = await supabase.storage.from("profile-avatars").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
    if (uploadError) { setProfileMessage(uploadError.message); return; }

    const { data } = supabase.storage.from("profile-avatars").getPublicUrl(path);
    const pendingUrl = data.publicUrl + "?v=" + Date.now();
    const { error } = await supabase.from("profiles").update({ avatar_url: pendingUrl, avatar_moderation_status: "pending" }).eq("id", user.id);
    if (error) { setProfileMessage(error.message); return; }

    setAvatarUrl(pendingUrl);
    setAvatarStatus("pending");
    setCropFile(null);
    setCropPreview("");
    setProfileMessage("Photo uploaded. It is pending moderation before appearing publicly.");
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileMessage("");
    const name = displayName.trim().slice(0, 80);
    const years = yearsPro.trim() ? Number(yearsPro) : null;
    if (years !== null && (!Number.isInteger(years) || years < 0 || years > 50)) {
      setProfileMessage("Years pro must be a whole number from 0 to 50.");
      setSavingProfile(false);
      return;
    }
    const updates = {
      display_name: name || null, bio: bio.trim().slice(0, 500) || null,
      position: position.trim().slice(0, 50) || null, years_pro: years,
      current_country: currentCountry.trim().slice(0, 80) || null,
      current_team: currentTeam.trim().slice(0, 120) || null,
      hometown: hometown.trim().slice(0,120) || null,
      nationality: nationality.trim().slice(0,80) || null,
      interests: interests.trim().slice(0,500) || null,
      favorite_leagues: favoriteLeagues.trim().slice(0,500) || null,
      experience_summary: profile.account_type === "coach" ? coachingExperience.trim().slice(0,1000) || null : null,
      profile_visibility: ["scout","agent","fan"].includes(profile.account_type) ? "private" : visibility,
      free_agent: profile.account_type === "player" ? freeAgent : false,
    };
    const { error } = await supabase.from("profiles").update(updates).eq("id", (await supabase.auth.getUser()).data.user?.id ?? "");
    if (error) setProfileMessage(error.message);
    else {
      setProfile((current) => ({ ...current, ...updates }));
      setDisplayName(name); setProfileMessage("Profile updated.");
    }
    setSavingProfile(false);
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) { setProfileMessage("Unable to sign out. Please try again."); return; }
    window.location.replace("/login");
  }

  if (loading) return <main className="page-shell account-page"><div className="page-container"><HoopLoading label="Loading your account..." /></div></main>;

  return (
    <main className="page-shell"><div className="page-container">
      <header className="topbar">
        <Link href="/" className="brand">HOOPCHECK</Link>
        <nav className="topnav"><Link href="/dashboard">Dashboard</Link><Link href="/membership">Membership</Link></nav>
      </header>
      <section className="hero-card"><div><p className="eyebrow">MY ACCOUNT</p><h1>{email}</h1><p className="muted">Manage your HoopCheck activity and submitted reviews.</p></div></section>
      <section className="grid" style={{marginTop:32}}>
        <div className="dashboard-card">
          <p className="eyebrow">PROFILE</p>
          {profile.account_type === "player" && <>
            {avatarUrl && <img src={avatarUrl} alt="Profile" style={{width:112,height:112,borderRadius:"50%",objectFit:"cover",border:"3px solid var(--orange)",display:"block"}} />}
            <label htmlFor="avatar-upload" className="muted">Player profile picture</label>
            <input id="avatar-upload" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0];if(f) chooseAvatar(f)}} />
            <p className="muted" style={{fontSize:12}}>{avatarStatus==="pending" ? "Pending moderation. It will appear publicly after approval." : avatarStatus==="rejected" ? "Photo rejected. Upload another image." : "Approved and eligible to appear on your public profile."}</p>
            {cropPreview && <div className="dashboard-card" style={{marginTop:12}}>
              <span className="card-kicker">CROP PHOTO</span>
              <div style={{width:"min(100%,280px)",aspectRatio:"1",overflow:"hidden",borderRadius:"50%",margin:"12px auto",border:"3px solid var(--orange)",background:"#111"}}>
                <img src={cropPreview} alt="Crop preview" style={{width:"100%",height:"100%",objectFit:"cover",transform:"scale("+cropZoom+")"}} />
              </div>
              <label className="muted" htmlFor="avatar-zoom">Zoom</label>
              <input id="avatar-zoom" type="range" min="1" max="3" step="0.05" value={cropZoom} onChange={e=>setCropZoom(Number(e.target.value))} style={{width:"100%"}} />
              <div className="actions">
                <button type="button" className="btn" onClick={()=>void cropAndUploadAvatar()}>Use Cropped Photo</button>
                <button type="button" className="btn dark" onClick={()=>{setCropFile(null);setCropPreview("")}}>Cancel</button>
              </div>
            </div>}
          </>}
          <h2>{profile.account_type === "player" ? "Player information" : profile.account_type === "coach" ? "Coach information" : "Profile information"} {((profile.account_type === "player" && profile.player_verified) || (profile.account_type === "coach" && profile.coach_verified)) && <span title="Verified professional" style={{color:"var(--orange)"}}>✓</span>}</h2>
          <form onSubmit={saveProfile} className="account-profile-form" style={{display:"grid",gap:12,marginTop:16}}>
            <label className="muted">First name</label><input value={profile.first_name ?? ""} readOnly />
            <label className="muted">Last name</label><input value={profile.last_name ?? ""} readOnly />
            <p className="muted" style={{fontSize:12}}>First and last name are locked and cannot be changed.</p>
            <label htmlFor="display-name" className="muted">Display name</label><input id="display-name" value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={80} placeholder="How players should see you" />
            {profile.account_type === "player" && <label htmlFor="position" className="muted">Position</label>}
            {profile.account_type === "player" && <input id="position" value={position} readOnly disabled />}
            {profile.account_type === "player" && <label htmlFor="years-pro" className="muted">Years as a pro</label>}
            {profile.account_type === "player" && <input id="years-pro" type="number" value={yearsPro} readOnly disabled />}
            {profile.account_type === "coach" && <><label htmlFor="coaching-experience" className="muted">Coaching experience</label><textarea id="coaching-experience" value={coachingExperience} onChange={e=>setCoachingExperience(e.target.value)} maxLength={1000} rows={4} placeholder="Years coaching, levels, roles, specialties, and professional experience." /><label htmlFor="coach-specialties" className="muted">Coaching specialties / basketball interests</label><textarea id="coach-specialties" value={interests} onChange={e=>setInterests(e.target.value)} maxLength={500} rows={3} placeholder="Player development, defense, scouting, strength & conditioning, etc." /></>}
            <label htmlFor="hometown">Hometown</label><input id="hometown" value={hometown} onChange={e=>setHometown(e.target.value)} maxLength={120} placeholder="City, State / Region" />
            <label htmlFor="nationality">Nationality</label>
            <select id="nationality" value={nationality} onChange={e=>setNationality(e.target.value)} disabled={savingProfile}>
              <option value="">Select nationality</option>
              <optgroup label="Africa">
                {["Algeria","Angola","Benin","Botswana","Burkina Faso","Burundi","Cameroon","Cape Verde","Central African Republic","Chad","Comoros","Côte d’Ivoire","Democratic Republic of the Congo","Djibouti","Egypt","Equatorial Guinea","Eritrea","Eswatini","Ethiopia","Gabon","Gambia","Ghana","Guinea","Guinea-Bissau","Kenya","Lesotho","Liberia","Libya","Madagascar","Malawi","Mali","Mauritania","Mauritius","Morocco","Mozambique","Namibia","Niger","Nigeria","Republic of the Congo","Rwanda","São Tomé and Príncipe","Senegal","Seychelles","Sierra Leone","Somalia","South Africa","South Sudan","Sudan","Tanzania","Togo","Tunisia","Uganda","Zambia","Zimbabwe"].map(x=><option key={x} value={x}>{x}</option>)}
              </optgroup>
              <optgroup label="Asia">
                {["Afghanistan","Armenia","Azerbaijan","Bahrain","Bangladesh","Bhutan","Brunei","Cambodia","China","Chinese Taipei","Cyprus","Georgia","Hong Kong","India","Indonesia","Iran","Iraq","Israel","Japan","Jordan","Kazakhstan","Kuwait","Kyrgyzstan","Laos","Lebanon","Malaysia","Maldives","Mongolia","Myanmar","Nepal","North Korea","Oman","Pakistan","Palestine","Philippines","Qatar","Saudi Arabia","Singapore","South Korea","Sri Lanka","Syria","Tajikistan","Thailand","Timor-Leste","Turkmenistan","United Arab Emirates","Uzbekistan","Vietnam","Yemen"].map(x=><option key={x} value={x}>{x}</option>)}
              </optgroup>
              <optgroup label="Europe">
                {["Albania","Andorra","Austria","Belarus","Belgium","Bosnia and Herzegovina","Bulgaria","Croatia","Czechia","Denmark","Estonia","Finland","France","Germany","Greece","Hungary","Iceland","Ireland","Italy","Kosovo","Latvia","Liechtenstein","Lithuania","Luxembourg","Malta","Moldova","Monaco","Montenegro","Netherlands","North Macedonia","Norway","Poland","Portugal","Romania","Russia","San Marino","Serbia","Slovakia","Slovenia","Spain","Sweden","Switzerland","Türkiye","Ukraine","United Kingdom","Vatican City"].map(x=><option key={x} value={x}>{x}</option>)}
              </optgroup>
              <optgroup label="North America">
                {["Antigua and Barbuda","Bahamas","Barbados","Belize","Canada","Costa Rica","Cuba","Dominica","Dominican Republic","El Salvador","Grenada","Guatemala","Haiti","Honduras","Jamaica","Mexico","Nicaragua","Panama","Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines","Trinidad and Tobago","United States"].map(x=><option key={x} value={x}>{x}</option>)}
              </optgroup>
              <optgroup label="South America">
                {["Argentina","Bolivia","Brazil","Chile","Colombia","Ecuador","Guyana","Paraguay","Peru","Suriname","Uruguay","Venezuela"].map(x=><option key={x} value={x}>{x}</option>)}
              </optgroup>
              <optgroup label="Oceania">
                {["Australia","Fiji","Kiribati","Marshall Islands","Micronesia","Nauru","New Zealand","Palau","Papua New Guinea","Samoa","Solomon Islands","Tonga","Tuvalu","Vanuatu"].map(x=><option key={x} value={x}>{x}</option>)}
              </optgroup>
            </select>
                        {profile.account_type === "player" && <>
              <label htmlFor="current-country" className="muted">Current country</label><select id="current-country" value={currentCountry} disabled><option value={currentCountry}>{currentCountry || "Not selected"}</option></select><p className="muted" style={{fontSize:12}}>Current country is managed through verified team changes.</p>
              <label htmlFor="current-team" className="muted">Current team</label><select id="current-team" value={currentTeam} disabled><option value={currentTeam}>{currentTeam || "Not selected"}</option></select><p className="muted" style={{fontSize:12}}>Current team is managed through player verification.</p>
            </>}
            <label htmlFor="bio" className="muted">Player bio</label><textarea id="bio" value={bio} onChange={e => setBio(e.target.value)} maxLength={500} rows={4} placeholder="Tell other players a little about your experience." />
                        {profile.account_type === "player" && <label className="checkbox-row"><input type="checkbox" checked={freeAgent} onChange={e=>setFreeAgent(e.target.checked)}/><span>Show me as a free agent</span></label>}
            {["scout","agent"].includes(profile.account_type) && <>
              <label htmlFor="interests" className="muted">Basketball interests</label><textarea id="interests" value={interests} onChange={e=>setInterests(e.target.value)} maxLength={500} rows={3} placeholder="Roles, regions, positions, or player types you follow." />
              <label htmlFor="favorite-leagues" className="muted">Leagues of interest</label><textarea id="favorite-leagues" value={favoriteLeagues} onChange={e=>setFavoriteLeagues(e.target.value)} maxLength={500} rows={3} placeholder="Leagues and markets you follow." />
            </>}
            {profile.account_type === "fan" && <label htmlFor="interests" className="muted">Basketball interests</label>}
            {profile.account_type === "fan" && <textarea id="interests" value={interests} onChange={e=>setInterests(e.target.value)} maxLength={500} rows={3} placeholder="Teams, players, leagues, or basketball topics you follow." />}
            {["scout","agent","fan"].includes(profile.account_type) ? <div className="card"><strong>🔒 Private profile</strong><p className="muted">Your scout, agent, or fan profile is private. Other users cannot open your profile as a public profile.</p></div> : <><label htmlFor="visibility" className="muted">Profile visibility</label><select id="visibility" value={visibility} onChange={e => setVisibility(e.target.value as "public" | "private")}><option value="public">Public</option><option value="private">Private</option></select></>}
            <p className="muted">Email: {email}</p>
            <div className="card" style={{marginTop:4}}><strong>✓ {profile.profile_claimed ? "Profile claimed" : "Claim your player profile"}</strong><p className="muted">{profile.profile_claimed ? "This HoopCheck profile is connected to your account and ready for you to manage." : "Claim this profile to manage your basketball information."}</p></div>
            {profile.account_type === "player" && <div className="card" style={{marginTop:8}}><strong>{profile.player_verified ? "✓ Verified Player" : "Player verification"}</strong><p className="muted">{profile.player_verified ? "Your professional-player account has been verified by HoopCheck." : "Apply for a verification badge to strengthen trust around your reviews."}</p>{!profile.player_verified && <Link href="/verification" className="btn dark">Request Verification</Link>}</div>}
            {profile.account_type === "coach" && <div className="card" style={{marginTop:8,border:"1px solid var(--orange)"}}><strong>{profile.coach_verified ? "✓ Verified Coach" : "Coach verification"}</strong><p className="muted">{profile.coach_verified ? "Your professional coach identity is verified. Pro and Premium coaches can request team placement." : "Pro and Premium coaches can verify their identity with a government ID/passport and live selfie, then request to be added to a team coaching staff."}</p>{!profile.coach_verified && <Link href="/verification" className="btn dark">Verify Coach</Link>}{profile.coach_verified && <Link href="/dashboard" className="btn dark">Request Team Placement</Link>}</div>}
            <button className="btn" type="submit" disabled={savingProfile}>{savingProfile ? "Saving..." : "Save Profile"}</button>
            {profileMessage && <p className="muted">{profileMessage}</p>}
          </form>
        </div>
        <div className="dashboard-card">
          <p className="eyebrow">MEMBERSHIP</p><h2>{subscription?.plan === "premium" ? "HoopCheck Premium" : subscription?.plan === "pro" ? "HoopCheck Pro" : "Free Membership"}</h2><p className="muted">Status: {subscription?.status ?? "inactive"}</p>
          {subscription?.current_period_end && <p className="muted">Current period ends: {new Date(subscription.current_period_end).toLocaleDateString()}</p>}
          {subscription?.cancel_at_period_end && <p className="muted">Cancellation is scheduled at the end of the current period.</p>}
          {subscription?.plan === "premium" && <div className="card" style={{marginTop:16,border:"1px solid var(--orange)"}}><p className="eyebrow">PREMIUM PLAYER FEATURE</p><h3 style={{marginBottom:8}}>🏀 Get Recruited — Coming Soon</h3><p className="muted">Premium players will soon be able to connect directly with scouts and agents, reach selected teams, and get discovered for opportunities.</p><p className="muted" style={{fontSize:12,marginBottom:0}}>We’re building a recruiting network designed to connect professional players with the right basketball opportunities.</p></div>}
          <div className="account-actions" style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:12}}><Link href="/membership" className="btn">Manage Membership</Link><button type="button" className="btn dark" onClick={signOut}>Sign Out</button></div>
        </div>
      </section>
      <section style={{marginTop:32}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,marginBottom:18}}><div><p className="eyebrow">REVIEW HISTORY</p><h2>My Reviews</h2></div><Link href="/search" className="btn">Find Another</Link></div>
      {!reviews.length ? <div className="dashboard-card"><h2>No reviews yet.</h2><p>Share your experience to help the next player make a better decision.</p></div> :
        <div style={{display:"grid",gap:16}}>{reviews.map(review => { const targetId=review.coach_id??review.team_id??review.league_id??""; const target=targets[targetId]; const href=review.coach_id?"/coaches/"+targetId:review.team_id?"/teams/"+targetId:"/leagues/"+targetId; return <article key={review.id} className="dashboard-card"><div style={{display:"flex",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}><div><span className="card-kicker">{review.coach_id?"COACH":review.team_id?"TEAM":"LEAGUE"}</span><h2>{target?.name??"Directory entry"}</h2></div><strong>{review.status.toUpperCase()}</strong></div>{review.title&&<h3>{review.title}</h3>}<p>{review.body}</p><p className="muted">Overall: {review.overall_rating}/5 · {new Date(review.created_at).toLocaleDateString()}</p><Link href={href} className="btn dark">View Profile</Link></article>; })}</div>}
      </section>
    </div></main>
  );
}