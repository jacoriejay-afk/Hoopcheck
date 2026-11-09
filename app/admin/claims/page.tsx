"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import HoopLoading from "../../../components/HoopLoading";
import Logo from "../../../components/Logo";

type Claim = {
  id:string;entity_type:"team"|"coach";entity_id:string;requester_id:string;organization_email:string|null;
  verification_method:"official_email"|"document";proof_document_path:string|null;status:"pending"|"approved"|"rejected";
  admin_note:string|null;reviewed_by:string|null;reviewed_at:string|null;created_at:string;
};
type Entity = {id:string;name:string};

export default function AdminClaimsPage() {
  const [claims,setClaims] = useState<Claim[]>([]);
  const [names,setNames] = useState<Record<string,string>>({});
  const [proofLinks,setProofLinks] = useState<Record<string,string>>({});
  const [notes,setNotes] = useState<Record<string,string>>({});
  const [loading,setLoading] = useState(true);
  const [busyId,setBusyId] = useState<string|null>(null);
  const [message,setMessage] = useState("");

  async function load() {
    setLoading(true);
    const {data:role,error:roleError}=await supabase.rpc("is_current_user_admin_or_moderator");
    if(roleError||!role){window.location.href="/dashboard";return;}
    const {data,error}=await supabase.from("profile_claim_requests")
      .select("id,entity_type,entity_id,requester_id,organization_email,verification_method,proof_document_path,status,admin_note,reviewed_by,reviewed_at,created_at")
      .order("created_at",{ascending:false}).limit(300);
    if(error){setMessage("Claim queue could not be loaded. Check the database migration and admin permissions.");setLoading(false);return;}
    const rows=(data||[]) as Claim[];
    setClaims(rows);
    setNotes(Object.fromEntries(rows.map(row=>[row.id,row.admin_note||""])));
    const teamIds=Array.from(new Set(rows.filter(row=>row.entity_type==="team").map(row=>row.entity_id)));
    const coachIds=Array.from(new Set(rows.filter(row=>row.entity_type==="coach").map(row=>row.entity_id)));
    const [teamResult,coachResult]=await Promise.all([
      teamIds.length?supabase.from("teams").select("id,name").in("id",teamIds):Promise.resolve({data:[] as Entity[]}),
      coachIds.length?supabase.from("coaches").select("id,name").in("id",coachIds):Promise.resolve({data:[] as Entity[]}),
    ]);
    const entityNames:Record<string,string>={};
    for(const row of teamResult.data||[]) entityNames["team:"+row.id]=row.name;
    for(const row of coachResult.data||[]) entityNames["coach:"+row.id]=row.name;
    setNames(entityNames);
    const links:Record<string,string>={};
    await Promise.all(rows.filter(row=>row.proof_document_path).map(async row=>{
      const {data:signed}=await supabase.storage.from("profile-claim-proofs").createSignedUrl(row.proof_document_path!,300);
      if(signed?.signedUrl) links[row.id]=signed.signedUrl;
    }));
    setProofLinks(links);
    setLoading(false);
  }

  useEffect(()=>{void load();},[]);

  async function decide(claim:Claim,status:"approved"|"rejected") {
    if(busyId) return;
    if(status==="rejected"&&!notes[claim.id]?.trim()&&!window.confirm("Reject this claim without an admin note?")) return;
    setBusyId(claim.id);setMessage("");
    const {data:{user}}=await supabase.auth.getUser();
    const {error}=await supabase.from("profile_claim_requests").update({
      status,admin_note:notes[claim.id]?.trim()||null,reviewed_by:user?.id||null,reviewed_at:new Date().toISOString()
    }).eq("id",claim.id);
    if(error) setMessage("Claim decision failed. "+error.message);
    else setMessage(status==="approved"?"Claim approved.":"Claim rejected.");
    setBusyId(null);
    if(!error) await load();
  }

  if(loading) return <main className="page-shell admin-light-shell"><div className="page-container"><HoopLoading label="Loading profile claim queue..." /></div></main>;
  return <main className="page-shell admin-light-shell"><div className="page-container">
    <header className="topbar"><Link href="/admin/directory" className="brand" aria-label="HoopCheck Admin"><Logo variant="full" size={30}/></Link><nav className="topnav"><Link href="/admin/reviews">Reviews</Link><Link href="/admin/users">Users</Link><Link href="/admin/directory">Directory</Link><Link href="/admin/team-fanfeed">Team FanFeed</Link></nav></header>
    <section className="hero-card"><p className="eyebrow">ADMIN · ORGANIZATION VERIFICATION</p><h1>Profile Claim Queue</h1><p className="muted">For team claims, require BOTH an organization-domain email and private documentary proof. Check the email domain against the club’s independently published contact details, verify the document names the claimant and organization, and reject mismatches or unverifiable claims. Approval enables official responses, never review editing or removal.</p></section>
    {message&&<p className="hc-claim-admin-message" role="status">{message}</p>}
    <div className="hc-claim-admin-summary"><strong>{claims.filter(row=>row.status==="pending").length}</strong><span>Pending claims</span><strong>{claims.filter(row=>row.status==="approved").length}</strong><span>Approved</span><strong>{claims.filter(row=>row.status==="rejected").length}</strong><span>Rejected</span></div>
    <section className="hc-claim-admin-list">
      {claims.map(claim=><article className="dashboard-card hc-claim-admin-card" key={claim.id}>
        <div className="hc-claim-admin-card__top"><div><span className={"hc-claim-admin-status is-"+claim.status}>{claim.status}</span><h2>{names[claim.entity_type+":"+claim.entity_id]||"Unknown organization profile"}</h2><p className="muted">{claim.entity_type.toUpperCase()} · Submitted {new Date(claim.created_at).toLocaleString()}</p></div><Link href={claim.entity_type==="team"?"/teams/"+claim.entity_id:"/coaches/"+claim.entity_id} className="hc-claim-admin-open">Open profile →</Link></div>
        <p><strong>Verification method:</strong> {claim.organization_email && claim.proof_document_path ? "Official organization email + documentary proof" : claim.organization_email ? "Email only — insufficient for team claims" : "Document only — insufficient for team claims"}</p>
        {claim.organization_email&&<p><strong>Organization email:</strong> {claim.organization_email}</p>}
        {proofLinks[claim.id]&&<p><a className="hc-claim-admin-open" href={proofLinks[claim.id]} target="_blank" rel="noreferrer">Open private evidence (expires in 5 minutes) ↗</a></p>}
        {claim.status==="pending"?<><label className="hc-claim-admin-note">Admin note<textarea value={notes[claim.id]||""} onChange={event=>setNotes(current=>({...current,[claim.id]:event.target.value}))} rows={2} maxLength={1000} placeholder="Reason, domain check, or decision notes…"/></label><div className="hc-claim-admin-actions"><button type="button" className="btn" disabled={busyId===claim.id} onClick={()=>void decide(claim,"approved")}>{busyId===claim.id?"Saving…":"Approve Claim"}</button><button type="button" className="btn dark" disabled={busyId===claim.id} onClick={()=>void decide(claim,"rejected")}>Reject Claim</button></div></>:<p className="muted">Reviewed {claim.reviewed_at?new Date(claim.reviewed_at).toLocaleString():"—"}{claim.admin_note?" · "+claim.admin_note:""}</p>}
      </article>)}
      {!claims.length&&<div className="dashboard-card"><h2>No profile claims yet</h2><p className="muted">Submitted team and coach claim requests will appear here.</p></div>}
    </section>
  </div></main>;
}
