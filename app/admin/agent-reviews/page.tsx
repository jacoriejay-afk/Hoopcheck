"use client";

import {useEffect,useState} from "react";
import Link from "next/link";
import {supabase} from "../../../lib/supabase";
import "../../agents/network.css";

type RecordItem={
 profile_id:string;public_name:string;agency_name:string;country:string;
 website_url:string|null;is_published:boolean;updated_at:string;
 review_status:string;review_note:string|null;reviewed_at:string|null;
 profiles:{account_type:string;moderation_status:string}|Array<{account_type:string;moderation_status:string}>;
};
export default function AgentReviewsPage(){
  const [items,setItems]=useState<RecordItem[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState("");
  const [notes,setNotes]=useState<Record<string,string>>({});
  const [attested,setAttested]=useState<Record<string,boolean>>({});
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    let active=true;
    void(async()=>{
      setLoading(true);setError("");
      const {data:{session}}=await supabase.auth.getSession();
      if(!active)return;
      if(!session){window.location.replace("/login?returnTo=/admin/agent-reviews");return;}
      const r=await fetch("/api/network/agent-reviews",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
      const payload=await r.json();
      if(!active)return;
      if(!r.ok)setError(payload.error||"Verification queue is unavailable.");
      else setItems(payload.showcases||[]);
      setLoading(false);
    })().catch(()=>{if(active){setError("Could not load professional reviews.");setLoading(false);}});
    return()=>{active=false;};
  },[refresh]);
  async function decide(item:RecordItem,approved:boolean){
    const note=notes[item.profile_id]?.trim()||"";
    if(note.length<30||!attested[item.profile_id]){setError("Document at least 30 characters of independent verification evidence and confirm the review.");return;}
    setBusy(item.profile_id);setError("");setNotice("");
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session)throw Error("Session expired.");
      const response=await fetch("/api/network/agent-reviews",{
        method:"POST",
        headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},
        body:JSON.stringify({profile_id:item.profile_id,approved,review_note:note,expected_updated_at:item.updated_at})
      });
      const result=await response.json();
      if(!response.ok){setError(result.error||"Review not saved.");return;}
      setNotice(approved?"Professional review approved and audited.":"Professional review rejected and audited.");
      setRefresh(v=>v+1);
    }catch{setError("Could not save the review.");}
    finally{setBusy("");}
  }
  return <main className="hc-network-page">
    <nav className="hc-network-back"><Link href="/admin/directory">Admin</Link> / Professional reviews</nav>
    <header className="hc-network-hero"><div>
      <p className="hc-network-eyebrow">AUTHORIZED MODERATION / ACCOUNTABLE REVIEWS</p>
      <h1>Agent <span>verification.</span></h1>
      <p>Review opt-in professional showcases. Independently confirm identity, actual agency affiliation and representation authority outside of member-provided claims before approving. Every decision retains a private note and reviewer record.</p>
    </div></header>
    {loading?<p className="hc-network-state" role="status">Loading authorized review queue…</p>
      :error&&!items.length?<section className="hc-network-state" role="alert">{error}</section>
      :<div className="hc-creator-editor" style={{maxWidth:950}}>
        {notice&&<p role="status" className="hc-network-state">{notice}</p>}
        {error&&<p role="alert" className="hc-network-state">{error}</p>}
        {items.length===0&&<p className="hc-network-state">No published professional showcases are awaiting review.</p>}
        {items.map(item=>{
          const p=Array.isArray(item.profiles)?item.profiles[0]:item.profiles;
          return <section className="hc-network-panel" key={item.profile_id}>
            <h2>{item.public_name||"Unnamed professional"}</h2>
            <p>{p?.account_type||"Agent / scout"} · {item.agency_name||"Independent"} · {item.country||"Country not supplied"}</p>
            <p>Status: <strong>{item.review_status}</strong> {item.reviewed_at&&"· reviewed "+new Date(item.reviewed_at).toLocaleDateString()}</p>
            {item.website_url&&<p><a href={item.website_url} target="_blank" rel="noopener noreferrer">Review public agency site</a></p>}
            {item.review_note&&<p>Prior internal review: {item.review_note}</p>}
            <label htmlFor={"review-"+item.profile_id}>Independent evidence and decision rationale (private, min. 30 characters)</label>
            <textarea id={"review-"+item.profile_id} rows={4} maxLength={1000}
              placeholder="Record the independently checked agency contact, date and verification method. Do not paste passwords or sensitive IDs."
              value={notes[item.profile_id]||""} onChange={e=>setNotes(v=>({...v,[item.profile_id]:e.target.value}))}/>
            <div className="hc-creator-publish"><input type="checkbox" id={"attest-"+item.profile_id}
              checked={Boolean(attested[item.profile_id])} onChange={e=>setAttested(v=>({...v,[item.profile_id]:e.target.checked}))}/>
              <label htmlFor={"attest-"+item.profile_id}>I have independently checked the stated agency affiliation or authority, reviewed any confidential support evidence through authorized channels, and accept responsibility for this decision.</label>
            </div>
            <div className="hc-creator-actions">
              <button type="button" disabled={busy===item.profile_id} onClick={()=>void decide(item,true)}>Approve reviewed status</button>
              <button type="button" disabled={busy===item.profile_id} onClick={()=>void decide(item,false)}>Reject review</button>
            </div>
          </section>;
        })}
      </div>}
  </main>;
}
