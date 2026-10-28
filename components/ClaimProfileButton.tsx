"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { HoopCheckDraw } from "./HoopMotion";

type ClaimProfileButtonProps = { entityType:"team"|"coach"; entityId:string; entityName:string };

const FREE_EMAIL_DOMAINS = new Set(["gmail.com","yahoo.com","outlook.com","hotmail.com","icloud.com","aol.com","proton.me","protonmail.com","live.com"]);

export default function ClaimProfileButton({entityType,entityId,entityName}:ClaimProfileButtonProps) {
  const [open,setOpen] = useState(false);
  const [method,setMethod] = useState<"official_email"|"document">("official_email");
  const [email,setEmail] = useState("");
  const [file,setFile] = useState<File|null>(null);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");

  async function submit() {
    if(busy) return;
    const {data:{session}} = await supabase.auth.getSession();
    if(!session?.user) { window.location.href="/login"; return; }
    if(method==="official_email") {
      const domain=email.trim().toLowerCase().split("@")[1];
      if(!domain || FREE_EMAIL_DOMAINS.has(domain)) { setMessage("Use an official organization email domain, not a personal email provider."); return; }
    } else {
      if(!file) { setMessage("Upload an official document to continue."); return; }
      if(file.size>10*1024*1024) { setMessage("Claim documents must be 10 MB or smaller."); return; }
      if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(file.type)) { setMessage("Upload a PDF, JPG, PNG, or WebP document."); return; }
    }
    setBusy(true);setMessage("");
    let proofDocumentPath:string|null=null;
    if(method==="document"&&file) {
      const safeName=file.name.toLowerCase().replace(/[^a-z0-9._-]+/g,"-").slice(-90);
      proofDocumentPath=session.user.id+"/"+crypto.randomUUID()+"-"+safeName;
      const {error:uploadError}=await supabase.storage.from("profile-claim-proofs").upload(proofDocumentPath,file,{upsert:false,contentType:file.type});
      if(uploadError) { setMessage("Document upload failed. Check the file and try again.");setBusy(false);return; }
    }
    const {error}=await supabase.from("profile_claim_requests").insert({
      entity_type:entityType,entity_id:entityId,requester_id:session.user.id,
      organization_email:method==="official_email"?email.trim().toLowerCase():null,
      verification_method:method,proof_document_path:proofDocumentPath,status:"pending"
    });
    if(error) setMessage(error.code==="23505"?"A claim request for this profile is already pending.":"Unable to submit the claim. Please try again.");
    else { setMessage("Claim submitted. HoopCheck admins will review the evidence."); setOpen(false); }
    setBusy(false);
  }

  return <div className="hc-claim-control">
    <button type="button" className="hc-claim-trigger" onClick={()=>{setMessage("");setOpen(value=>!value);}}><span aria-hidden="true">✓</span> Claim This Profile</button>
    {open&&<div className="hc-claim-panel">
      <div className="hc-claim-panel__heading"><div><p className="eyebrow">ORGANIZATION VERIFICATION</p><h3>Claim {entityName}</h3></div><button type="button" aria-label="Close claim form" onClick={()=>setOpen(false)}>×</button></div>
      <p>Claims are reviewed by a HoopCheck admin. Claiming a profile does not let an organization edit or remove player reviews.</p>
      <div className="hc-claim-methods">
        <label><input type="radio" checked={method==="official_email"} onChange={()=>setMethod("official_email")}/><span><strong>Official email</strong><small>Use an organization-domain email address.</small></span></label>
        <label><input type="radio" checked={method==="document"} onChange={()=>setMethod("document")}/><span><strong>Upload proof</strong><small>Submit an official letter, contract, or organization document.</small></span></label>
      </div>
      {method==="official_email" ? <label className="hc-claim-field">Organization email<input type="email" value={email} onChange={event=>setEmail(event.target.value)} placeholder="name@club-domain.com" /></label>
        : <label className="hc-claim-field">Verification document<input type="file" accept=".pdf,image/jpeg,image/png,image/webp" onChange={event=>setFile(event.target.files?.[0]||null)}/><small>PDF, JPG, PNG, or WebP · max 10 MB · stored privately</small></label>}
      {message&&<p className="hc-claim-message" role="status">{message.startsWith("Claim submitted.")&&<HoopCheckDraw label="Team claim submitted" />}{message}</p>}
      <button type="button" className="btn" disabled={busy} onClick={()=>void submit()}>{busy?"Submitting…":"Submit for Admin Review"}</button>
    </div>}
    {!open&&message&&<small className="hc-claim-message" role="status">{message.startsWith("Claim submitted.")&&<HoopCheckDraw label="Team claim submitted" />}{message}</small>}
  </div>;
}
