"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const TERMS_VERSION = "2026-10-01";

export default function SignupPage() {
const router = useRouter();

const [firstName, setFirstName] = useState("");
const [username, setUsername] = useState("");
const [lastName, setLastName] = useState("");
const [accountType, setAccountType] = useState<"player"|"coach"|"scout"|"agent"|"fan">("player");
const [professionalExperience, setProfessionalExperience] = useState(false);
const [yearsPro, setYearsPro] = useState("0");
const [position, setPosition] = useState("PG");
const [formerTeams, setFormerTeams] = useState<string[]>([]);
const [teams, setTeams] = useState<{id:string;name:string;country:string|null;league_name:string|null}[]>([]);
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [isAdult, setIsAdult] = useState(false);
const [agreedToTerms, setAgreedToTerms] = useState(false);

const [loading, setLoading] = useState(false);
const [message, setMessage] = useState("");
const [error, setError] = useState("");

useEffect(() => {
  supabase.from("teams").select("id,name,country,league_name").eq("active", true).order("name").limit(300).then(({ data }) => setTeams(data || []));
}, []);

async function handleSignup(event: FormEvent) {
event.preventDefault();

setLoading(true);
setError("");
setMessage("");
if (firstName.trim().length < 2 || lastName.trim().length < 2) {
  setError("Please enter your first and last name.");
  setLoading(false);
  return;
}
if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) { setError("Username must be 3–20 characters using only letters, numbers, or underscores."); setLoading(false); return; }
if (password.length < 6) {
  setError("Password must be at least 6 characters.");
  setLoading(false);
  return;
}
if (!isAdult) {
  setError("You must confirm that you are 18 or older.");
  setLoading(false);
  return;
}
if (!agreedToTerms) {
  setError(
    "Please agree to the Terms of Service and acknowledge the Privacy Policy."
  );
  setLoading(false);
  return;
}
const { data, error } = await supabase.auth.signUp({
  email: email.trim().toLowerCase(),
  password,
  options: {
    data: {
      full_name: `${firstName.trim()} ${lastName.trim()}`,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      account_type: accountType,
      username: username.trim().toLowerCase(),
      position: accountType === "player" ? position : null,
      years_pro: accountType === "player" ? Number(yearsPro) : null,
      professional_experience: professionalExperience,
      former_team_ids: formerTeams,
      is_adult: true,
      agreed_to_terms: true,
      terms_accepted_at: new Date().toISOString(),
      terms_version: TERMS_VERSION,
    },
  },
});
if (error) {
  setError(error.message);
  setLoading(false);
  return;
}
if (data.session) {
  router.push("/onboarding");
  return;
}
setMessage(
  "Account created. Check your email to confirm your account before logging in."
);
setLoading(false);

}

return (
<main>
<nav className="nav">
  <Link href="/" className="logo">
    Hoop<span>Check</span>
  </Link>
    <div className="links">
      <Link href="/login">Log In</Link>
    </div>
  </nav>
  <section className="auth-page">
    <div className="auth-hero">
      <div className="eyebrow">JOIN HOOPCHECK</div>
      <h1>
        Know before
        <br />
        you commit.
      </h1>
      <p>
        Join the global basketball research platform built for players
        who want real information before making their next career
        decision.
      </p>
      <div className="feature-grid">
        <div className="feature">
          <strong>01</strong>
          <span>Research coaches worldwide.</span>
        </div>
        <div className="feature">
          <strong>02</strong>
          <span>Research professional teams.</span>
        </div>
        <div className="feature">
          <strong>03</strong>
          <span>Learn about leagues from players.</span>
        </div>
      </div>
    </div>
    <div className="auth-card">
      <div className="eyebrow">CREATE ACCOUNT</div>
      <h2>Start your HoopCheck account.</h2>
      <p className="intro">
        Create a free account to begin researching the basketball world.
      </p>
      <form onSubmit={handleSignup}>
        <label htmlFor="username">Username</label><input id="username" value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" placeholder="yourname" required />
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><label htmlFor="first-name">First Name</label><input id="first-name" value={firstName} onChange={e=>setFirstName(e.target.value)} autoComplete="given-name" required /></div>
          <div><label htmlFor="last-name">Last Name</label><input id="last-name" value={lastName} onChange={e=>setLastName(e.target.value)} autoComplete="family-name" required /></div>
        </div>
        <label htmlFor="account-type">Account Type</label>
        <select id="account-type" value={accountType} onChange={e=>setAccountType(e.target.value as "player"|"coach"|"scout"|"agent"|"fan")}>
          <option value="player">Player — professional basketball player</option>
          <option value="scout">Scout — research only</option>
          <option value="agent">Agent — research only</option>
          <option value="fan">Fan — research only</option>
          <option value="coach">Coach — research only</option>
        </select>
        <p className="muted" style={{fontSize:12}}>Scouts, agents, and fans can create Pro or Premium accounts for full research access, but only verified professional players can submit ratings or reviews.</p>
        <label>Position</label>
        <select value={position} onChange={e=>setPosition(e.target.value)} disabled={accountType !== "player"}><option value="PG">Point Guard (PG)</option><option value="SG">Shooting Guard (SG)</option><option value="SF">Small Forward (SF)</option><option value="PF">Power Forward (PF)</option><option value="C">Center (C)</option></select>
        <label>Professional Experience</label>
        <select value={professionalExperience ? "yes" : "no"} onChange={e=>setProfessionalExperience(e.target.value==="yes")}>
          <option value="yes">Yes — I have played professionally</option>
          <option value="no">No — not yet</option>
        </select>
        <label htmlFor="years-pro-signup">Years as a professional</label>
        <select id="years-pro-signup" value={yearsPro} onChange={e=>setYearsPro(e.target.value)}>
          {Array.from({length:26},(_,i)=><option key={i} value={i}>{i === 0 ? "0 years" : i + " year" + (i===1 ? "" : "s")}</option>)}
        </select>
        <label>Former/current professional teams</label>
        <p className="muted" style={{fontSize:12}}>Select teams you have played for. These are saved for review eligibility and can be verified by HoopCheck.</p>
        <div style={{maxHeight:220,overflow:"auto",display:"grid",gap:7,border:"1px solid var(--border)",padding:10,borderRadius:10}}>
          {teams.map(team=><label key={team.id} className="checkbox-row"><input type="checkbox" checked={formerTeams.includes(team.id)} onChange={e=>setFormerTeams(v=>e.target.checked ? [...v,team.id] : v.filter(id=>id!==team.id))}/><span>{team.name}{team.league_name ? " — " + team.league_name : ""}</span></label>)}
        </div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 6 characters"
          autoComplete="new-password"
          required
        />
        <div className="legal-consent">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={isAdult}
              onChange={(event) => setIsAdult(event.target.checked)}
            />
            <span>
              I confirm that I am 18 years of age or older.
            </span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(event) =>
                setAgreedToTerms(event.target.checked)
              }
            />
            <span>
              I agree to the{" "}
              <Link href="/terms">Terms of Service</Link> and acknowledge
              the <Link href="/privacy">Privacy Policy</Link>. I have also
              reviewed the{" "}
              <Link href="/community-guidelines">
                Community Guidelines
              </Link>
              .
            </span>
          </label>
        </div>
        {error && (
          <div className="message error">{error}</div>
        )}
        {message && (
          <div className="message success">{message}</div>
        )}
        <button
          type="submit"
          className="btn submit"
          disabled={loading}
        >
          {loading ? "Creating Account..." : "Create Free Account"}
        </button>
      </form>
      <div className="login-link">
        Already have an account?{" "}
        <Link href="/login">Log in</Link>
      </div>
    </div>
  </section>
</main>

);
}
