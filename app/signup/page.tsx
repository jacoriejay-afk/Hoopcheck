"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const TERMS_VERSION = "2026-10-01";
type AccountType = "player" | "coach" | "scout" | "agent" | "fan";
type Team = { id:string; name:string; country:string|null; league_name:string|null };

const ACCOUNT_TYPES: {value:AccountType; title:string; description:string; icon:string}[] = [
  {value:"player",title:"Player",description:"Professional basketball player building a verified profile and sharing first-hand experience.",icon:"🏀"},
  {value:"coach",title:"Coach",description:"Coach or basketball professional researching organizations and the basketball market.",icon:"📋"},
  {value:"scout",title:"Scout",description:"Scout researching players, teams, leagues, and talent to follow.",icon:"🔎"},
  {value:"agent",title:"Agent",description:"Agent researching players, teams, leagues, and recruiting opportunities.",icon:"🤝"},
  {value:"fan",title:"Fan",description:"Fan following teams and exploring the global basketball community.",icon:"🔥"},
];

export default function SignupPage() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [firstName,setFirstName]=useState(""); const [lastName,setLastName]=useState("");
  const [username,setUsername]=useState(""); const [position,setPosition]=useState("PG");
  const [yearsPro,setYearsPro]=useState("0"); const [professionalExperience,setProfessionalExperience]=useState(false);
  const [formerTeams,setFormerTeams]=useState<string[]>([]); const [favoriteTeamId,setFavoriteTeamId]=useState("");
  const [teams,setTeams]=useState<Team[]>([]);
  const [teamCountry,setTeamCountry]=useState(""); const [teamLeague,setTeamLeague]=useState("");
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [confirmPassword,setConfirmPassword]=useState("");
  const [birthMonth,setBirthMonth]=useState(""); const [birthDay,setBirthDay]=useState(""); const [birthYear,setBirthYear]=useState(""); const [gender,setGender]=useState(""); const [agreedToTerms,setAgreedToTerms]=useState(false);
  const [loading,setLoading]=useState(false); const [error,setError]=useState("");

  useEffect(()=>{supabase.from("teams").select("id,name,country,league_name").eq("active",true).order("name").limit(1000).then(({data})=>setTeams(data||[]));},[]);

  const isPlayer = accountType === "player";
  const teamCountries=Array.from(new Set(teams.map(t=>t.country).filter(Boolean) as string[])).sort();
  const teamLeagues=Array.from(new Set(teams.filter(t=>!teamCountry||t.country===teamCountry).map(t=>t.league_name).filter(Boolean) as string[])).sort();
  const filteredTeams=teams.filter(t=>(!teamCountry||t.country===teamCountry)&&(!teamLeague||t.league_name===teamLeague));

  async function handleSignup(event:FormEvent){
    event.preventDefault(); setLoading(true); setError("");
    if(!accountType){setError("Choose an account type first.");setLoading(false);return;}
    if(firstName.trim().length<2||lastName.trim().length<2){setError("Please enter your first and last name.");setLoading(false);return;}
    if(!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())){setError("Username must be 3–20 characters using only letters, numbers, or underscores.");setLoading(false);return;}
    if(password.length<6){setError("Password must be at least 6 characters.");setLoading(false);return;}
    if(password!==confirmPassword){setError("Passwords do not match.");setLoading(false);return;}
    if(!birthMonth||!birthDay||!birthYear){setError("Birthdate is required.");setLoading(false);return;}\n    const birthdate=`${birthYear}-${birthMonth.padStart(2,"0")}-${birthDay.padStart(2,"0")}`; const maxDay=new Date(Date.UTC(Number(birthYear),Number(birthMonth),0)).getUTCDate();\n    if(Number(birthDay)<1||Number(birthDay)>maxDay){setError("Please enter a valid birthdate.");setLoading(false);return;}\n    const today=new Date(); let age=today.getFullYear()-Number(birthYear); const birthdayPassed=(today.getMonth()+1>Number(birthMonth))||(today.getMonth()+1===Number(birthMonth)&&today.getDate()>=Number(birthDay)); if(!birthdayPassed) age--;\n    if(age<18){setError("You must be 18 or older.");setLoading(false);return;}\n    if(!gender){setError("Gender is required.");setLoading(false);return;}
    if(!agreedToTerms){setError("Please agree to the Terms of Service and acknowledge the Privacy Policy.");setLoading(false);return;}

    const favoriteTeamName=teams.find(t=>t.id===favoriteTeamId)?.name||"";
    const {data,error}=await supabase.auth.signUp({
      email:email.trim().toLowerCase(), password,
      options:{data:{
        full_name:`${firstName.trim()} ${lastName.trim()}`, first_name:firstName.trim(), last_name:lastName.trim(),
        account_type:accountType, username:username.trim().toLowerCase(),
        position:isPlayer?position:null, years_pro:isPlayer?Number(yearsPro):null,
        professional_experience:isPlayer?professionalExperience:false,
        former_team_ids:isPlayer?formerTeams:[], favorite_teams:favoriteTeamName,
        is_adult:true, birthdate, gender, agreed_to_terms:true, terms_accepted_at:new Date().toISOString(), terms_version:TERMS_VERSION,
      }}
    });
    if(error){setError(error.message);setLoading(false);return;}
    if(data.session){router.push(accountType==="fan" ? "/dashboard" : "/onboarding");return;}
    router.push(`/signup/complete?email=${encodeURIComponent(email.trim().toLowerCase())}`);
  }

  return <main className="auth-page-shell">
    <nav className="nav signup-nav">
      <Link href="/" className="logo">HOOP<span>CHECK</span></Link>
      <Link href="/login">Log In</Link>
    </nav>
    <section className="auth-page signup-page">
      <div className="auth-hero">
        <div className="eyebrow">JOIN HOOPCHECK</div>
        <h1>Choose your lane.<br/>Then build your experience.</h1>
        <p>HoopCheck adapts the signup experience to how you use basketball. Players get professional profile tools; fans, scouts, agents, and coaches get a cleaner research-first experience.</p>
        <div className="feature-grid">
          <div className="feature"><strong>01</strong><span>Research global basketball.</span></div>
          <div className="feature"><strong>02</strong><span>Follow teams you care about.</span></div>
          <div className="feature"><strong>03</strong><span>Connect with the basketball community.</span></div>
        </div>
      </div>

      <div className="auth-card signup-card">
        <div className="eyebrow">STEP 01 · ACCOUNT TYPE</div>
        <h2>How will you use HoopCheck?</h2>
        <p className="intro">Choose this first. We’ll only show you the questions that apply to your account.</p>
        <div className="account-type-grid">
          {ACCOUNT_TYPES.map(type=><button key={type.value} type="button" onClick={()=>{if(!accountType){setAccountType(type.value);setError("");}}} className={`account-type-choice ${accountType===type.value?"selected":""}`}>
            <span className="account-type-icon">{type.icon}</span><span><strong>{type.title}</strong><small>{type.description}</small></span><span className="account-type-check">{accountType===type.value?"✓":"+"}</span>
          </button>)}
        </div>

        {accountType && <form onSubmit={handleSignup} className="signup-form">
          <div className="signup-step-label">STEP 02 · CREATE YOUR ACCOUNT</div>
          <div className="signup-account-badge"><strong>{ACCOUNT_TYPES.find(x=>x.value===accountType)?.title}</strong><span className="muted">Account type is locked after selection.</span></div>
          <div className="signup-two-col">
            <div><label htmlFor="first-name">First Name</label><input id="first-name" value={firstName} onChange={e=>setFirstName(e.target.value)} autoComplete="given-name" required /></div>
            <div><label htmlFor="last-name">Last Name</label><input id="last-name" value={lastName} onChange={e=>setLastName(e.target.value)} autoComplete="family-name" required /></div>
          </div>
          <label htmlFor="username">Username</label><input id="username" value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" placeholder="yourname" required />

          {isPlayer ? <>
            <div className="signup-two-col">
              <div><label>Position</label><select value={position} onChange={e=>setPosition(e.target.value)}><option value="PG">Point Guard (PG)</option><option value="SG">Shooting Guard (SG)</option><option value="SF">Small Forward (SF)</option><option value="PF">Power Forward (PF)</option><option value="C">Center (C)</option></select></div>
              <div><label>Years as a professional</label><select value={yearsPro} onChange={e=>setYearsPro(e.target.value)}>{Array.from({length:26},(_,i)=><option key={i} value={i}>{i===0?"0 years":`${i} ${i===1?"year":"years"}`}</option>)}</select></div>
            </div>
            <label>Professional experience</label><select value={professionalExperience?"yes":"no"} onChange={e=>setProfessionalExperience(e.target.value==="yes")}><option value="yes">Yes — I have played professionally</option><option value="no">No — not yet</option></select>
            <label>Former / current professional team</label>
            <select multiple size={5} value={formerTeams} onChange={e=>setFormerTeams(Array.from(e.target.selectedOptions).map(o=>o.value).slice(0,8))}>
              {filteredTeams.map(t=><option key={t.id} value={t.id}>{t.name}{t.country?" — "+t.country:""}{t.league_name?" · "+t.league_name:""}</option>)}
            </select>
            <p className="form-hint">Select the teams you have played for. These are saved for verification and review eligibility.</p>
          </> : <div className="non-player-preferences">
            <div className="signup-step-label">BASKETBALL TO FOLLOW</div>
            <div className="signup-two-col fan-team-filters"><div><label htmlFor="fan-team-country">Country</label><select id="fan-team-country" value={teamCountry} onChange={e=>{setTeamCountry(e.target.value);setTeamLeague("");setFavoriteTeamId("");}}><option value="">All countries</option>{teamCountries.map(x=><option key={x} value={x}>{x}</option>)}</select></div><div><label htmlFor="fan-team-league">League</label><select id="fan-team-league" value={teamLeague} onChange={e=>{setTeamLeague(e.target.value);setFavoriteTeamId("");}}><option value="">All leagues</option>{teamLeagues.map(x=><option key={x} value={x}>{x}</option>)}</select></div></div><label htmlFor="favorite-team">Choose a team to follow</label>
            <select id="favorite-team" value={favoriteTeamId} onChange={e=>setFavoriteTeamId(e.target.value)}>
              <option value="">Select a team</option>
              {teams.map(t=><option key={t.id} value={t.id}>{t.name}{t.country?" — "+t.country:""}{t.league_name?" · "+t.league_name:""}</option>)}
            </select>
            <p className="form-hint">No player-position, years-pro, or former-team questions for {accountType}s. You can follow more teams after signup.</p>
          </div>}

          <div className="signup-two-col">
            <div><label htmlFor="birth-month">Birthdate</label><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1.2fr",gap:8}}><select id="birth-month" value={birthMonth} onChange={e=>setBirthMonth(e.target.value)} required><option value="">Month</option>{Array.from({length:12},(_,i)=><option key={i+1} value={String(i+1)}>{new Date(2000,i,1).toLocaleString("en-US",{month:"long"})}</option>)}</select><select id="birth-day" value={birthDay} onChange={e=>setBirthDay(e.target.value)} required><option value="">Day</option>{Array.from({length:31},(_,i)=><option key={i+1} value={String(i+1)}>{i+1}</option>)}</select><select id="birth-year" value={birthYear} onChange={e=>setBirthYear(e.target.value)} required><option value="">Year</option>{Array.from({length:new Date().getFullYear()-1900+1},(_,i)=>new Date().getFullYear()-i).map(y=><option key={y} value={y}>{y}</option>)}</select></div></div>
            <div><label htmlFor="gender">Gender</label><select id="gender" value={gender} onChange={e=>setGender(e.target.value)} required><option value="">Select gender</option><option value="male">Male</option><option value="female">Female</option><option value="non_binary">Non-binary</option><option value="prefer_not_to_say">Prefer not to say</option></select></div>
          </div>
          <label htmlFor="email">Email</label><input id="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
          <div className="signup-two-col">
            <div><label htmlFor="password">Password</label><input id="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" required /></div>
            <div><label htmlFor="confirm-password">Confirm Password</label><input id="confirm-password" type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password" required /></div>
          </div>
          <div className="legal-consent">
            <p className="form-hint">Your birthdate is required to verify that you are 18 or older and is stored securely on your HoopCheck profile.</p>
            <label className="checkbox-row"><input type="checkbox" checked={agreedToTerms} onChange={e=>setAgreedToTerms(e.target.checked)}/><span>I agree to the <Link href="/terms">Terms of Service</Link> and acknowledge the <Link href="/privacy">Privacy Policy</Link> and <Link href="/community-guidelines">Community Guidelines</Link>.</span></label>
          </div>
          {error&&<div className="message error">{error}</div>}
          <button type="submit" className="btn submit" disabled={loading}>{loading?"Creating Account...":`Create ${ACCOUNT_TYPES.find(x=>x.value===accountType)?.title} Account`}</button>
        </form>}
        {!accountType&&<div className="signup-gate"><span>👆</span><strong>Select an account type to continue.</strong><small>Your choices are tailored to your role.</small></div>}
        <div className="login-link">Already have an account? <Link href="/login">Log in</Link></div>
      </div>
    </section>
  </main>;
}
