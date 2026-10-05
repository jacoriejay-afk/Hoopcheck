"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import HoopLoading from "../../components/HoopLoading";
import { supabase } from "../../lib/supabase";

export default function VerificationPage() {
  const [team,setTeam]=useState("");
  const [country,setCountry]=useState("");
  const [league,setLeague]=useState("");
  const [note,setNote]=useState("");
  const [evidenceUrl,setEvidenceUrl]=useState("");
  const [documentType,setDocumentType]=useState<"passport"|"basketball_license"|"national_id"|"other">("basketball_license");
  const [documentFile,setDocumentFile]=useState<File|null>(null);
  const [status,setStatus]=useState<string|null>(null);
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(true);
  const [submitting,setSubmitting]=useState(false);

  useEffect(()=>{(async()=>{
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){window.location.href="/login";return;}
    const {data}=await supabase.from("player_verification_requests").select("status").eq("user_id",user.id).order("created_at",{ascending:false}).limit(1).maybeSingle();
    setStatus(data?.status ?? null); setLoading(false);
  })()},[]);

  async function submit(e:React.FormEvent){
    e.preventDefault(); setMessage(""); setSubmitting(true);
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){window.location.href="/login";return;}
    let documentPath: string | null = null;
    if (documentFile) {
      if (documentFile.size > 10 * 1024 * 1024) { setMessage("Document must be 10 MB or smaller."); setSubmitting(false); return; }
      const ext = documentFile.name.split(".").pop()?.toLowerCase() || "bin";
      documentPath = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("player-verification-documents").upload(documentPath, documentFile, { upsert: false });
      if (uploadError) { setMessage("We could not securely upload that document. Please try again."); setSubmitting(false); return; }
    }
    const {error}=await supabase.from("player_verification_requests").insert({
      user_id:user.id,current_team:team.trim().slice(0,120)||null,
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
       <form onSubmit={submit} style={{display:"grid",gap:12}}>
        <label>Current team<input value={team} onChange={e=>setTeam(e.target.value)} maxLength={120} placeholder="Team name"/></label>
        <label>Current country<input value={country} onChange={e=>setCountry(e.target.value)} maxLength={80} placeholder="Country"/></label>
        <label>League<input value={league} onChange={e=>setLeague(e.target.value)} maxLength={120} placeholder="League"/></label>
        <label>Proof / public basketball link (optional)<input value={evidenceUrl} onChange={e=>setEvidenceUrl(e.target.value)} maxLength={500} placeholder="Team roster, league profile, agency, or personal site"/></label>
        <label>Anything else we should know?<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={1000} rows={5}/></label>
        {message&&<p role="status">{message}</p>}
        <button className="btn" disabled={submitting}>{submitting?"Submitting...":"Request Verification"}</button>
        <p className="muted">Do not submit passwords, financial information, or sensitive identity documents in this form.</p>
       </form>}
    </section>
  </div></main>;
}