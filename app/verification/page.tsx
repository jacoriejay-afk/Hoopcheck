"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import HoopLoading from "../../components/HoopLoading";
import { supabase } from "../../lib/supabase";

export default function VerificationPage() {
  const [team,setTeam]=useState("");
  const [teamId,setTeamId]=useState("");
  const [basketballType,setBasketballType]=useState<"mens"|"womens">("mens");
  const [womensTeams,setWomensTeams]=useState<{id:string;name:string;country:string|null}[]>([]);
  const [womensTeamId,setWomensTeamId]=useState("");
  const [teams,setTeams]=useState<{id:string;name:string;country:string|null;league_name:string|null}[]>([]);
  const [country,setCountry]=useState("");
  const [league,setLeague]=useState("");
  const [note,setNote]=useState("");
  const [evidenceUrl,setEvidenceUrl]=useState("");
  const [documentType,setDocumentType]=useState<"passport"|"basketball_license"|"national_id"|"other">("basketball_license");
  const [documentFile,setDocumentFile]=useState<File|null>(null);
  const [status,setStatus]=useState<string|null>(null);
  const [identityStatus,setIdentityStatus]=useState<string>("not_started");
  const [identityLoading,setIdentityLoading]=useState(false);
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(true);
  const [submitting,setSubmitting]=useState(false);

  useEffect(()=>{(async()=>{
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){window.location.href="/login";return;}
    const {data:profile}=await supabase.from("profiles").select("account_type,basketball_type,identity_verification_status").eq("id",user.id).maybeSingle(); if(profile?.account_type !== "player"){window.location.href="/account";return;} setBasketballType(profile?.basketball_type||"mens"); setIdentityStatus(profile?.identity_verification_status || "not_started");
    const {data:{session}}=await supabase.auth.getSession();
    if(session?.access_token){
      const identityRes=await fetch("/api/verification/identity",{headers:{Authorization:"Bearer "+session.access_token}});
      const identityBody=await identityRes.json().catch(()=>({}));
      if(identityRes.ok && identityBody.status){setIdentityStatus(identityBody.status);}
    }
    const {data:teamData}=await supabase.from("teams").select("id,name,country,league_name").eq("active",true).order("name").limit(500);
    setTeams(teamData||[]); const {data:wt}=await supabase.from("womens_teams").select("id,name,country").eq("active",true).order("name"); setWomensTeams(wt||[]);
    const {data}=await supabase.from("player_verification_requests").select("status").eq("user_id",user.id).order("created_at",{ascending:false}).limit(1).maybeSingle();
    setStatus(data?.status ?? null); setLoading(false);
  })()},[]);

  async function startIdentityVerification(){
    setIdentityLoading(true); setMessage("");
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){window.location.href="/login";return;}
    const res=await fetch("/api/verification/identity",{method:"POST",headers:{Authorization:"Bearer "+session.access_token}});
    const body=await res.json().catch(()=>({}));
    if(!res.ok){setMessage(body.error||"Unable to start identity verification.");setIdentityLoading(false);return;}
    if(body.status)setIdentityStatus(body.status);
    if(body.url)window.location.href=body.url;
    else setMessage("Identity verification session created. Please try again if the verification window did not open.");
    setIdentityLoading(false);
  }

  async function submit(e:React.FormEvent){
    e.preventDefault(); setMessage(""); setSubmitting(true);
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){window.location.href="/login";return;}
    if (!teamId && !womensTeamId && !evidenceUrl.trim() && !documentFile) { setMessage("Select your current team or provide proof of professional basketball (a public link or document)."); setSubmitting(false); return; }
    let documentPath: string | null = null;
    if (documentFile) {
      if (documentFile.size > 10 * 1024 * 1024) { setMessage("Document must be 10 MB or smaller."); setSubmitting(false); return; }
      const ext = documentFile.name.split(".").pop()?.toLowerCase() || "bin";
      documentPath = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("player-verification-documents").upload(documentPath, documentFile, { upsert: false });
      if (uploadError) { setMessage("We could not securely upload that document. Please try again."); setSubmitting(false); return; }
    }
    const {error}=await supabase.from("player_verification_requests").insert({
      user_id:user.id,team_id:basketballType==="mens" ? (teamId||null) : null,womens_team_id:basketballType==="womens" ? (womensTeamId||null) : null,current_team:team.trim().slice(0,120)||null,
      current_country:country.trim().slice(0,80)||null,
      league:league.trim().slice(0,120)||null,note:note.trim().slice(0,1000)||null,evidence_url:evidenceUrl.trim().slice(0,500)||null,
      document_type: documentFile ? documentType : null, document_path: documentPath, document_uploaded_at: documentPath ? new Date().toISOString() : null
    });
    if(error) setMessage(error.code==="23505"?"You already have a pending verification request.":"Unable to submit your request. Please try again.");
    else {setStatus("pending");setMessage("Verification request submitted. Our team will review your document and player information manually.");}
    setSubmitting(false);
  }

  if(loading)return <main className="page-shell"><div className="page-container"><HoopLoading label="Loading verification center..." /></div></main>;
  return <main className="page-shell"><div className="page-container">
    <header className="topbar"><Link href="/" className="brand">HOOPCHECK</Link><nav className="topnav"><Link href="/account">Account</Link></nav></header>
    <section className="hero-card"><p className="eyebrow">PLAYER VERIFICATION</p><h1>Get your player badge.</h1><p className="muted">Verification helps HoopCheck distinguish professional-player accounts from ordinary accounts. We review requests manually.</p></section>
    <section className="dashboard-card" style={{marginTop:24}}>
      {status==="approved" ? <><h2>✓ Verified Player</h2><p className="muted">Your account is verified.</p></> :
       status==="pending" ? <><h2>Request under review</h2><p className="muted">We have your request. You do not need to submit another one.</p></> :
       <><div className="card" style={{marginBottom:16,border:"1px solid var(--orange)"}}>
        <p className="eyebrow">IDENTITY CHECK</p>
        <h2>{identityStatus==="verified" ? "✓ Identity verified" : "Verify with ID + face scan"}</h2>
        <p className="muted">HoopCheck uses Stripe Identity to verify your government ID or passport and compare it with a live selfie. HoopCheck does not store your face scan.</p>
        {identityStatus!=="verified" && <button type="button" className="btn" onClick={startIdentityVerification} disabled={identityLoading}>{identityLoading?"Opening secure verification...":"Start secure ID + face verification"}</button>}
        {identityStatus==="processing" && <p className="muted">Your identity check is processing. Keep this page available and return after Stripe finishes the check.</p>}
       </div>
       <form onSubmit={submit} style={{display:"grid",gap:12}}>
        <label>Basketball type<select value={basketballType} onChange={e=>setBasketballType(e.target.value as "mens"|"womens")}><option value="mens">Men’s Basketball</option><option value="womens">Women’s Basketball</option></select></label><label>Current team{basketballType==="mens"?<select value={teamId} onChange={e=>{const id=e.target.value;setTeamId(id);const t=teams.find(x=>x.id===id);setTeam(t?.name||"");}}><option value="">Select current team</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}{t.country?` — ${t.country}`:""}</option>)}</select>:<select value={womensTeamId} onChange={e=>{const id=e.target.value;setWomensTeamId(id);const t=womensTeams.find(x=>x.id===id);setTeam(t?.name||"");}}><option value="">Select women’s team</option>{womensTeams.map(t=><option key={t.id} value={t.id}>{t.name}{t.country?` — ${t.country}`:""}</option>)}</select>}</label>
        <label>Current country<input value={country} onChange={e=>setCountry(e.target.value)} maxLength={80} placeholder="Country"/></label>
        <label>League<input value={league} onChange={e=>setLeague(e.target.value)} maxLength={120} placeholder="League"/></label>
        <label>Proof / public basketball link<input value={evidenceUrl} onChange={e=>setEvidenceUrl(e.target.value)} maxLength={500} placeholder="Team roster, league profile, agency, or personal site"/><small className="muted">Provide a public proof link, upload a document below, or both.</small></label>
        <label>Verification document (optional)<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e=>setDocumentFile(e.target.files?.[0]||null)} /></label>
        {documentFile&&<label>Document type<select value={documentType} onChange={e=>setDocumentType(e.target.value as "passport"|"basketball_license"|"national_id"|"other")}><option value="basketball_license">Basketball license</option><option value="passport">Passport</option><option value="national_id">National ID</option><option value="other">Other</option></select></label>}
        <label>Anything else we should know?<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={1000} rows={5}/></label>
        {message&&<p role="status">{message}</p>}
        <button className="btn" disabled={submitting}>{submitting?"Submitting...":"Request Verification"}</button>
        <p className="muted">Use the secure identity check above for passports/IDs and face matching. Do not upload identity documents through this fallback form unless HoopCheck support specifically asks you to.</p>
       </form></>}
    </section>
  </div></main>;
}