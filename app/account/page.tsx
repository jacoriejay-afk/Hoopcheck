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
  player_verified: boolean;
  profile_claimed: boolean;
  avatar_url: string | null;
  avatar_moderation_status: "pending" | "approved" | "rejected";
};

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
  const [profile, setProfile] = useState<Profile>({ account_type: "player", display_name: null, first_name: null, last_name: null, professional_experience: false, bio: null, position: null, years_pro: null, current_country: null, current_team: null, profile_visibility: "public", player_verified: false, profile_claimed: true, avatar_url: null, avatar_moderation_status: "approved" });
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
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [freeAgent, setFreeAgent] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarStatus, setAvatarStatus] = useState<"pending"|"approved"|"rejected">("approved");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      setEmail(user.email ?? "");
      const [{ data: profileData }, { data: subscriptionData }] = await Promise.all([
        supabase.from("profiles").select("account_type,display_name,first_name,last_name,professional_experience,bio,position,years_pro,current_country,current_team,profile_visibility,player_verified,profile_claimed,avatar_url,avatar_moderation_status").eq("id", user.id).maybeSingle(),
        supabase.from("subscriptions").select("plan,status,current_period_end,cancel_at_period_end").eq("user_id", user.id).maybeSingle(),
      ]);
      const nextProfile: Profile = profileData ?? { display_name: null, first_name: null, last_name: null, professional_experience: false, bio: null, position: null, years_pro: null, current_country: null, current_team: null, profile_visibility: "public", player_verified: false, profile_claimed: true, avatar_url: null, avatar_moderation_status: "approved" };
      setProfile(nextProfile);
      setDisplayName(nextProfile.display_name ?? "");
      setBio(nextProfile.bio ?? "");
      setPosition(nextProfile.position ?? "");
      setYearsPro(nextProfile.years_pro?.toString() ?? "");
      setCurrentCountry(nextProfile.current_country ?? "");
      setCurrentTeam(nextProfile.current_team ?? "");
      setHometown((nextProfile as any).hometown ?? ""); setNationality((nextProfile as any).nationality ?? ""); setFreeAgent(Boolean((nextProfile as any).free_agent));
      setVisibility(nextProfile.profile_visibility ?? "public");
      setAvatarUrl(nextProfile.avatar_url ?? "");
      setAvatarStatus(nextProfile.avatar_moderation_status ?? "approved");
      setSubscription(subscriptionData ?? null);
      setVerified(Boolean(nextProfile.player_verified));
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


  async function uploadAvatar(file: File) {
    if (!file.type.startsWith("image/")) { setProfileMessage("Please choose an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { setProfileMessage("Profile photos must be 5MB or smaller."); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = user.id + "/avatar." + ext;
    const { error: uploadError } = await supabase.storage.from("profile-avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) { setProfileMessage(uploadError.message); return; }
    const { data } = supabase.storage.from("profile-avatars").getPublicUrl(path);
    const pendingUrl = data.publicUrl + "?v=" + Date.now();
    const { error } = await supabase.from("profiles").update({ avatar_url: pendingUrl }).eq("id", user.id);
    if (error) { setProfileMessage(error.message); return; }
    setAvatarUrl(pendingUrl); setAvatarStatus("pending"); setProfileMessage("Photo uploaded. It is pending moderation before appearing publicly.");
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
      display_name: name || null,
      bio: bio.trim().slice(0, 500) || null,
      position: position.trim().slice(0, 50) || null,
      years_pro: years,
      current_country: currentCountry.trim().slice(0, 80) || null,
      current_team: currentTeam.trim().slice(0, 120) || null,
      hometown: hometown.trim().slice(0,120) || null,
      nationality: nationality.trim().slice(0,80) || null,
      profile_visibility: visibility,
      free_agent: freeAgent,
    };
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "");

    if (error) {
      setProfileMessage(error.message);
    } else {
      setProfile((current) => ({ ...current, ...updates }));
      setDisplayName(name);
      setProfileMessage("Profile updated.");
    }
    setSavingProfile(false);
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      setProfileMessage("Unable to sign out. Please try again.");
      return;
    }
    window.location.replace("/login");
  }

  if (loading) return <main className="page-shell account-page"><div className="page-container"><HoopLoading label="Loading your account..." /></div></main>;

  return (
    <main className="page-shell"><div className="page-container">
      <header className="topbar">
        <Link href="/" className="brand">HOOPCHECK</Link>
        <nav className="topnav"><Link href="/dashboard">Dashboard</Link><Link href="/membership">Membership</Link></nav>
      </header>
      <section className="hero-card">
        <div><p className="eyebrow">MY ACCOUNT</p><h1>{email}</h1><p className="muted">Manage your HoopCheck activity and submitted reviews.</p></div>
      </section>
      <section className="grid" style={{marginTop:32}}>
        <div className="dashboard-card">
          <p className="eyebrow">PROFILE</p>
          {avatarUrl && <img src={avatarUrl} alt="Profile" style={{width:84,height:84,borderRadius:"50%",objectFit:"cover",border:"2px solid var(--border)"}} />}
          <label htmlFor="avatar-upload" className="muted">Profile picture</label><input id="avatar-upload" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0];if(f) void uploadAvatar(f)}} />
          <p className="muted" style={{fontSize:12}}>{avatarStatus==="pending" ? "Pending moderation." : avatarStatus==="rejected" ? "Photo rejected. Upload another image." : "Approved for public display."}</p>
          <h2>{nextProfile.account_type === "player" ? "Player information" : "Profile information"} {nextProfile.account_type === "player" && verified && <span title="Verified professional player" style={{color:"var(--orange)"}}>✓</span>}</h2>
          <form onSubmit={saveProfile} className="account-profile-form" style={{display:"grid",gap:12,marginTop:16}}>
            <label className="muted">First name</label><input value={profile.first_name ?? ""} readOnly />
            <label className="muted">Last name</label><input value={profile.last_name ?? ""} readOnly />
            <p className="muted" style={{fontSize:12}}>First and last name are locked and cannot be changed.</p>
            <label htmlFor="display-name" className="muted">Display name</label>
            <input id="display-name" value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={80} placeholder="How players should see you" />
            {profile.account_type === "player" && <label htmlFor="position" className="muted">Position</label>}
            {profile.account_type === "player" && <input id="position" value={position} readOnly disabled />}
            {profile.account_type === "player" && <label htmlFor="years-pro" className="muted">Years as a pro</label>}
            {profile.account_type === "player" && <input id="years-pro" type="number" value={yearsPro} readOnly disabled />}
            <label htmlFor="hometown">Hometown</label><input id="hometown" value={hometown} onChange={e=>setHometown(e.target.value)} maxLength={120} placeholder="City, State / Region" />
            <label htmlFor="nationality">Nationality</label>
            <select id="nationality" value={nationality} onChange={e=>setNationality(e.target.value)} disabled={savingProfile}>
              <option value="">Select nationality</option>
              <option value="United States">United States</option>
              <option value="Azerbaijan">Azerbaijan</option>
              <option value="Albania">Albania</option>
              <option value="Argentina">Argentina</option>
              <option value="Australia">Australia</option>
              <option value="Austria">Austria</option>
              <option value="Belgium">Belgium</option>
              <option value="Bosnia and Herzegovina">Bosnia and Herzegovina</option>
              <option value="Brazil">Brazil</option>
              <option value="Bulgaria">Bulgaria</option>
              <option value="Canada">Canada</option>
              <option value="China">China</option>
              <option value="Croatia">Croatia</option>
              <option value="Cyprus">Cyprus</option>
              <option value="Czechia">Czechia</option>
              <option value="Denmark">Denmark</option>
              <option value="Egypt">Egypt</option>
              <option value="Estonia">Estonia</option>
              <option value="Finland">Finland</option>
              <option value="France">France</option>
              <option value="Georgia">Georgia</option>
              <option value="Germany">Germany</option>
              <option value="Greece">Greece</option>
              <option value="Hungary">Hungary</option>
              <option value="Iceland">Iceland</option>
              <option value="India">India</option>
              <option value="Ireland">Ireland</option>
              <option value="Israel">Israel</option>
              <option value="Italy">Italy</option>
              <option value="Japan">Japan</option>
              <option value="Kosovo">Kosovo</option>
              <option value="Latvia">Latvia</option>
              <option value="Lebanon">Lebanon</option>
              <option value="Lithuania">Lithuania</option>
              <option value="Luxembourg">Luxembourg</option>
              <option value="Mexico">Mexico</option>
              <option value="Montenegro">Montenegro</option>
              <option value="Morocco">Morocco</option>
              <option value="Netherlands">Netherlands</option>
              <option value="New Zealand">New Zealand</option>
              <option value="Nigeria">Nigeria</option>
              <option value="North Macedonia">North Macedonia</option>
              <option value="Norway">Norway</option>
              <option value="Philippines">Philippines</option>
              <option value="Poland">Poland</option>
              <option value="Portugal">Portugal</option>
              <option value="Romania">Romania</option>
              <option value="Serbia">Serbia</option>
              <option value="Slovakia">Slovakia</option>
              <option value="Slovenia">Slovenia</option>
              <option value="South Africa">South Africa</option>
              <option value="South Korea">South Korea</option>
              <option value="Spain">Spain</option>
              <option value="Sweden">Sweden</option>
              <option value="Switzerland">Switzerland</option>
              <option value="Tunisia">Tunisia</option>
              <option value="Türkiye">Türkiye</option>
              <option value="Ukraine">Ukraine</option>
              <option value="United Kingdom">United Kingdom</option>
            </select>
            <label htmlFor="current-country" className="muted">Current country</label>
            <select id="current-country" value={currentCountry} disabled><option value={currentCountry}>{currentCountry || "Not selected"}</option></select><p className="muted" style={{fontSize:12}}>Country changes are tied to verified team changes.</p>
            <label htmlFor="current-team" className="muted">Current team</label>
            <select id="current-team" value={currentTeam} disabled><option value={currentTeam}>{currentTeam || "Not selected"}</option></select>
            <p className="muted" style={{fontSize:12}}>Current team is locked until HoopCheck verifies that you are on another club. Start a new verification request to change it.</p>
            <label htmlFor="bio" className="muted">Player bio</label>
            <textarea id="bio" value={bio} onChange={e => setBio(e.target.value)} maxLength={500} rows={4} placeholder="Tell other players a little about your experience." />
            <label className="checkbox-row"><input type="checkbox" checked={freeAgent} onChange={e=>setFreeAgent(e.target.checked)}/><span>Show me as a free agent</span></label>
            <label htmlFor="visibility" className="muted">Profile visibility</label>
            <select id="visibility" value={visibility} onChange={e => setVisibility(e.target.value as "public" | "private")}>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
            <p className="muted">Email: {email}</p>
            <div className="card" style={{marginTop:4}}><strong>✓ {profile.profile_claimed ? "Profile claimed" : "Claim your player profile"}</strong><p className="muted">{profile.profile_claimed ? "This HoopCheck profile is connected to your account and ready for you to manage." : "Claim this profile to manage your basketball information."}</p></div>
            {profile.account_type === "player" && <div className="card" style={{marginTop:8}}>
              <strong>{verified ? "✓ Verified Player" : "Player verification"}</strong>
              <p className="muted">{verified ? "Your professional-player account has been verified by HoopCheck." : "Apply for a verification badge to strengthen trust around your reviews."}</p>
              {!verified && <Link href="/verification" className="btn dark">Request Verification</Link>}
            </div>}
            <button className="btn" type="submit" disabled={savingProfile}>{savingProfile ? "Saving..." : "Save Profile"}</button>
            {profileMessage && <p className="muted">{profileMessage}</p>}
          </form>
        </div>

        <div className="dashboard-card">
          <p className="eyebrow">MEMBERSHIP</p>
          <h2>{subscription?.plan === "premium" ? "HoopCheck Premium" : subscription?.plan === "pro" ? "HoopCheck Pro" : "Free Membership"}</h2>
          <p className="muted">Status: {subscription?.status ?? "inactive"}</p>
          {subscription?.current_period_end && <p className="muted">Current period ends: {new Date(subscription.current_period_end).toLocaleDateString()}</p>}
          {subscription?.cancel_at_period_end && <p className="muted">Cancellation is scheduled at the end of the current period.</p>}
          {subscription?.plan === "premium" && (
            <div className="card" style={{marginTop:16,border:"1px solid var(--orange)"}}>
              <p className="eyebrow">PREMIUM PLAYER FEATURE</p>
              <h3 style={{marginBottom:8}}>🏀 Get Recruited — Coming Soon</h3>
              <p className="muted">Premium players will soon be able to connect directly with scouts and agents, reach selected teams, and get discovered for opportunities.</p>
              <p className="muted" style={{fontSize:12,marginBottom:0}}>We’re building a recruiting network designed to connect professional players with the right basketball opportunities.</p>
            </div>
          )}
          <div className="account-actions" style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:12}}>
            <Link href="/membership" className="btn">Manage Membership</Link>
            <button type="button" className="btn dark" onClick={signOut}>Sign Out</button>
          </div>
        </div>
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