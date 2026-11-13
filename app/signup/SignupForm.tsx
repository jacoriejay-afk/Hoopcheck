"use client";

import { FormEvent, useRef, useState } from "react";
import UsernameField, { type UsernameFieldHandle } from "../../components/UsernameField";
import Link from "next/link";
import GoogleSignInButton from "../../components/GoogleSignInButton";
import { useRouter } from "next/navigation";
import { HoopIcon, type HoopIconName } from "../../components/HoopCheckUI";
import { supabase } from "../../lib/supabase";
import { useLanguage, type Language } from "../../components/LanguageProvider";
import TeamLeaguePicker from "../../components/TeamLeaguePicker";

const TERMS_VERSION = "2026-10-01";
type AccountType = "player" | "coach" | "manager" | "scout" | "agent" | "fan";

const ACCOUNT_TYPES: {value:AccountType; title:string; description:string; icon:HoopIconName}[] = [
  {value:"player",title:"Player",description:"Professional basketball player: build a verified career profile, research before signing, review teams you played for, and connect with the basketball industry.",icon:"basketball"},
  {value:"coach",title:"Coach",description:"Coach: build a coaching profile, research organizations, and claim your team when authorized.",icon:"clipboard-check"},
  {value:"manager",title:"Team Manager",description:"Team manager or club representative: claim your organization, submit verification, and manage official team updates after approval.",icon:"users"},
  {value:"scout",title:"Scout",description:"Scout: discover players and research teams, leagues, markets, and talent around the world.",icon:"search"},
  {value:"agent",title:"Agent",description:"Agent: research players, teams, leagues, markets, and recruiting opportunities.",icon:"users"},
  {value:"fan",title:"Fan",description:"Fan: follow favorite teams, track leagues, and personalize a basketball-first experience.",icon:"star"},
];

export default function SignupForm({ googleEmail }: { googleEmail?: string }) {
  const isGoogleSignup = googleEmail !== undefined;
  const router = useRouter();
  const { language, setLanguage } = useLanguage();
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [firstName,setFirstName]=useState(""); const [lastName,setLastName]=useState("");
  const [username,setUsername]=useState(""); const usernameFieldRef=useRef<UsernameFieldHandle>(null); const [position,setPosition]=useState("PG");
  const [yearsPro,setYearsPro]=useState("0"); const [professionalExperience,setProfessionalExperience]=useState(false);
  const [formerTeams,setFormerTeams]=useState<string[]>([]); const [favoriteTeamName,setFavoriteTeamName]=useState("");
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [confirmPassword,setConfirmPassword]=useState("");
  const [birthMonth,setBirthMonth]=useState(""); const [birthDay,setBirthDay]=useState(""); const [birthYear,setBirthYear]=useState(""); const [gender,setGender]=useState(""); const [agreedToTerms,setAgreedToTerms]=useState(false);
  const [loading,setLoading]=useState(false); const [error,setError]=useState("");

  const isPlayer = accountType === "player";

  async function handleSignup(event:FormEvent){
    event.preventDefault(); setLoading(true); setError("");
    if(!accountType){setError("Choose an account type first.");setLoading(false);return;}
    if(firstName.trim().length<2||lastName.trim().length<2){setError("Please enter your first and last name.");setLoading(false);return;}
    const usernameCheck=await usernameFieldRef.current?.validate();
    if(!usernameCheck?.valid){setError("Username: "+(usernameCheck?.message||"Please check your username."));usernameFieldRef.current?.focus();setLoading(false);return;}
    if(!isGoogleSignup && password.length<6){setError("Password must be at least 6 characters.");setLoading(false);return;}
    if(!isGoogleSignup && password!==confirmPassword){setError("Passwords do not match.");setLoading(false);return;}
    if(!birthMonth||!birthDay||!birthYear){setError("Birthdate is required.");setLoading(false);return;}
    const birthdate=`${birthYear}-${birthMonth.padStart(2,"0")}-${birthDay.padStart(2,"0")}`; const maxDay=new Date(Date.UTC(Number(birthYear),Number(birthMonth),0)).getUTCDate();
    if(!Number.isInteger(Number(birthYear)) || Number(birthYear) < 1900 || Number(birthYear) > new Date().getFullYear() || !Number.isInteger(Number(birthMonth)) || Number(birthMonth) < 1 || Number(birthMonth) > 12 || !Number.isInteger(Number(birthDay)) || Number(birthDay) < 1 || Number(birthDay) > maxDay){setError("Please enter a valid birthdate.");setLoading(false);return;}
    const today=new Date(); let age=today.getFullYear()-Number(birthYear); const birthdayPassed=(today.getMonth()+1>Number(birthMonth))||(today.getMonth()+1===Number(birthMonth)&&today.getDate()>=Number(birthDay)); if(!birthdayPassed) age--;
    if(age<18){setError("You must be 18 or older.");setLoading(false);return;}
    if(!gender){setError("Gender is required.");setLoading(false);return;}
    if(!agreedToTerms){setError("Please agree to the Terms of Service and acknowledge the Privacy Policy.");setLoading(false);return;}

    const metadata = {
      full_name: `${firstName.trim()} ${lastName.trim()}`, first_name: firstName.trim(), last_name: lastName.trim(),
      account_type: accountType, username: username.trim().toLowerCase(),
      basketball_type: isPlayer ? (gender === "female" ? "womens" : "mens") : null,
      position: isPlayer ? position : null, years_pro: isPlayer ? Number(yearsPro) : null,
      professional_experience: isPlayer && professionalExperience,
      former_team_ids: isPlayer ? formerTeams : [], favorite_teams: favoriteTeamName,
      is_adult: true, birthdate, gender, agreed_to_terms: true,
      terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION,
    };

    try {
    if (isGoogleSignup) {
      const { error: profileError } = await supabase.rpc("complete_google_signup", { signup: metadata });
      if (profileError?.code === "23505") {
        setError("That username is taken. Choose another username.");
        usernameFieldRef.current?.focus();
        setLoading(false);
        return;
      }
      if (profileError) throw profileError;
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) throw refreshError;
      const { data: auth } = await supabase.auth.getClaims();
      if (auth?.claims.role !== "authenticated") throw new Error("Member session unavailable");
      // The new server request sees the refreshed member session and clears the setup cookie.
      window.location.replace("/signup/complete");
      return;
    }
    const {data,error}=await supabase.auth.signUp({
      email:email.trim().toLowerCase(), password, options:{data:metadata, emailRedirectTo: "https://hoopcheck.online/signup/complete"}
    });
    if(error) throw error;
    const normalizedEmail = email.trim().toLowerCase();
    if (!data.session) {
      // Supabase may require email confirmation before creating an authenticated session.
      // Send users to a clear confirmation screen instead of implying they are already logged in.
      router.push(`/signup/complete?email=${encodeURIComponent(normalizedEmail)}&confirmation=required`);
      return;
    }
    router.push(`/signup/complete?email=${encodeURIComponent(normalizedEmail)}`);
    } catch (signupError) {
      console.error("Signup failed:",signupError);
      setError(isGoogleSignup
        ? "We couldn't finish your Google signup. Try again, or sign in with Google to resume."
        : signupError instanceof Error ? signupError.message : "We couldn't create your account right now. Please try again.");
      setLoading(false);
    }
  }

  return <main className="auth-page-shell">
    <div className="signup-utility-row" aria-label="Sign-up options">
      <div className="signup-nav-actions">
        <label htmlFor="signup-language" className="sr-only">Choose language</label>
        <select id="signup-language" aria-label="Choose language" value={language} onChange={(event) => setLanguage(event.target.value as Language)} className="signup-language-select">
          <option value="en">English</option><option value="es">Español</option><option value="fr">Français</option>
          <option value="de">Deutsch</option><option value="tr">Türkçe</option><option value="pt">Português</option>
          <option value="it">Italiano</option><option value="el">Ελληνικά</option><option value="ar">العربية</option>
          <option value="ru">Русский</option><option value="az">Azərbaycanca</option><option value="pl">Polski</option>
          <option value="zh">简体中文</option><option value="ja">日本語</option><option value="sr">Српски</option>
          <option value="fi">Suomi</option><option value="he">עברית</option>
        </select>
        <Link href="/login">Log In</Link>
      </div>
    </div>
    <section className="auth-page signup-page">
      <div className="auth-hero">
        <div className="eyebrow">JOIN HOOPCHECK</div>
        <h1>Choose your lane.<br/>Then build your experience.</h1>
        <p>HoopCheck adapts the signup experience to how you use basketball. Players get professional profile tools; coaches and team managers can request team control; fans, scouts, and agents get a research-first experience.</p>
        <div className="feature-grid">
          <div className="feature"><strong>01</strong><span>Research global basketball.</span></div>
          <div className="feature"><strong>02</strong><span>Follow teams you care about.</span></div>
          <div className="feature"><strong>03</strong><span>Connect with the basketball community.</span></div>
        </div>
      </div>

      <div className="auth-card signup-card">
        {isGoogleSignup
          ? <p className="intro">Finish setting up HoopCheck with {googleEmail || "your Google account"}.</p>
          : <GoogleSignInButton disabled={loading} />}
        <div className="eyebrow">STEP 01 · ACCOUNT TYPE</div>
        <h2>How will you use HoopCheck?</h2>
        <p className="intro">Choose this first. We’ll only show you the questions that apply to your account.</p>
        <div className="account-type-grid">
          {ACCOUNT_TYPES.map(type=><button key={type.value} type="button" onClick={()=>{if(!accountType){setAccountType(type.value);setError("");}}} className={`account-type-choice ${accountType===type.value?"selected":""}`}>
            <span className="account-type-icon"><HoopIcon name={type.icon} size={22} /></span><span><strong>{type.title}</strong><small>{type.description}</small></span><span className="account-type-check">{accountType===type.value?<HoopIcon name="check" size={16} />:<HoopIcon name="arrow-right" size={16} />}</span>
          </button>)}
        </div>

        {accountType && <form onSubmit={handleSignup} className="signup-form">
          <div className="signup-step-label">STEP 02 · CREATE YOUR ACCOUNT</div>
          <div className="signup-account-badge"><strong>{ACCOUNT_TYPES.find(x=>x.value===accountType)?.title}</strong><span className="muted">Account type is locked after selection.</span>{accountType === "player" && gender === "female" && <span className="women-category-badge">Women’s HoopCheck</span>}</div>
          <div className="signup-two-col">
            <div><label htmlFor="first-name">First Name</label><input id="first-name" value={firstName} onChange={e=>setFirstName(e.target.value)} autoComplete="given-name" required /></div>
            <div><label htmlFor="last-name">Last Name</label><input id="last-name" value={lastName} onChange={e=>setLastName(e.target.value)} autoComplete="family-name" required /></div>
          </div>
          <UsernameField ref={usernameFieldRef} value={username} onChange={setUsername} disabled={loading} />

          {isPlayer ? <>
            <div className="signup-two-col">
              <div><label>Position</label><select value={position} onChange={e=>setPosition(e.target.value)}><option value="PG">Point Guard (PG)</option><option value="SG">Shooting Guard (SG)</option><option value="SF">Small Forward (SF)</option><option value="PF">Power Forward (PF)</option><option value="C">Center (C)</option></select></div>
              <div><label>Years as a professional</label><select value={yearsPro} onChange={e=>setYearsPro(e.target.value)}>{Array.from({length:26},(_,i)=><option key={i} value={i}>{i===0?"0 years":`${i} ${i===1?"year":"years"}`}</option>)}</select></div>
            </div>
            <label>Professional experience</label><select value={professionalExperience?"yes":"no"} onChange={e=>setProfessionalExperience(e.target.value==="yes")}><option value="yes">Yes — I have played professionally</option><option value="no">No — not yet</option></select>
            <TeamLeaguePicker mode="team" label="Former / current professional teams" multiple values={formerTeams} onChangeMany={setFormerTeams} basketballType={gender==="female"?"womens":"mens"} placeholder="Search and add teams" />
            <p className="form-hint">Select the teams you have played for. These are saved for verification and review eligibility.</p>
          </> : <div className="non-player-preferences">
            <div className="signup-step-label">BASKETBALL TO FOLLOW</div>
            <TeamLeaguePicker mode="team" label="Choose a team to follow" value={favoriteTeamName} returnValue="name" onChange={setFavoriteTeamName} basketballType={null} placeholder="Search teams by name, city or country" />
            <p className="form-hint">No player-position, years-pro, or former-team questions for {accountType}s. You can follow more teams after signup.</p>
          </div>}

          <div className="signup-two-col">
            <div><label htmlFor="birth-month">Birthdate</label><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1.2fr",gap:8}}><select id="birth-month" value={birthMonth} onChange={e=>setBirthMonth(e.target.value)} required><option value="">Month</option>{Array.from({length:12},(_,i)=><option key={i+1} value={String(i+1)}>{new Date(2000,i,1).toLocaleString("en-US",{month:"long"})}</option>)}</select><select id="birth-day" value={birthDay} onChange={e=>setBirthDay(e.target.value)} required><option value="">Day</option>{Array.from({length:31},(_,i)=><option key={i+1} value={String(i+1)}>{i+1}</option>)}</select><select id="birth-year" value={birthYear} onChange={e=>setBirthYear(e.target.value)} required><option value="">Year</option>{Array.from({length:new Date().getFullYear()-1900+1},(_,i)=>new Date().getFullYear()-i).map(y=><option key={y} value={y}>{y}</option>)}</select></div></div>
            <div><label htmlFor="gender">Gender</label><select id="gender" value={gender} onChange={e=>{const next=e.target.value;const categoryChanged=(gender==="female")!==(next==="female");setGender(next);if(isPlayer&&categoryChanged)setFormerTeams([]);}} required><option value="">Select gender</option><option value="male">Male</option><option value="female">Female</option><option value="non_binary">Non-binary</option><option value="prefer_not_to_say">Prefer not to say</option></select></div>
          </div>
          {!isGoogleSignup && <><label htmlFor="email">Email</label><input id="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
          <div className="signup-two-col">
            <div><label htmlFor="password">Password</label><input id="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" required /></div>
            <div><label htmlFor="confirm-password">Confirm Password</label><input id="confirm-password" type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password" required /></div>
          </div>
          </>}
          <div className="legal-consent">
            <p className="form-hint">Your birthdate is required to verify that you are 18 or older and is stored securely on your HoopCheck profile.</p>
            <label className="checkbox-row"><input type="checkbox" checked={agreedToTerms} onChange={e=>setAgreedToTerms(e.target.checked)}/><span>I agree to the <Link href="/terms">Terms of Service</Link> and acknowledge the <Link href="/privacy">Privacy Policy</Link> and <Link href="/community-guidelines">Community Guidelines</Link>.</span></label>
          </div>
          {error&&<div className="message error">{error}</div>}
          <button type="submit" className="btn submit" disabled={loading}>{loading?"Creating Account...":`Create ${ACCOUNT_TYPES.find(x=>x.value===accountType)?.title} Account`}</button>
        </form>}
        {!accountType&&<div className="signup-gate"><span aria-hidden="true"><HoopIcon name="arrow-right" size={18} /></span><strong>Select an account type to continue.</strong><small>Your choices are tailored to your role.</small></div>}
        <div className="login-link">Already have an account? <Link href="/login">Log in</Link></div>
      </div>
    </section>
  </main>;
}
