"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type ClaimProfileButtonProps = { entityType:"team"|"coach"; entityId:string; entityName:string };
const FREE_EMAIL_DOMAINS = new Set(["gmail.com","yahoo.com","outlook.com","hotmail.com","icloud.com","aol.com","proton.me","protonmail.com","live.com"]);

export default function ClaimProfileButton({entityType,entityId,entityName}:ClaimProfileButtonProps) {
  const [open,setOpen] = useState(false);
  const [eligible,setEligible] = useState(false);
  const [eligibilityChecked,setEligibilityChecked] = useState(false);
  const [email,setEmail] = useState("");
  const [file,setFile] = useState<File|null>(null);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { if (active) setEligibilityChecked(true); return; }
      const { data } = await supabase.from("profiles").select("account_type").eq("id", session.user.id).maybeSingle();
      if (active) {
        setEligible(data?.account_type === "coach" || data?.account_type === "manager");
        setEligibilityChecked(true);
      }
    })();
    return () => { active = false; };
  }, []);

  async function submit() {
    if (busy) return;
    const {data:{session}} = await supabase.auth.getSession();
    if (!session?.user) { window.location.href="/login"; return; }
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail) {
      const domain=normalizedEmail.split("@")[1];
      if (!normalizedEmail.includes("@") || !domain || FREE_EMAIL_DOMAINS.has(domain)) {
        setMessage("Use an official organization email domain, not a personal email provider."); return;
      }
    }
    if (!normalizedEmail && !file) {
      setMessage("Enter your official organization email. You may also attach a supporting document."); return;
    }
    if (file && file.size > 10*1024*1024) { setMessage("Claim documents must be 10 MB or smaller."); return; }
    if (file && !["application/pdf","image/jpeg","image/png","image/webp"].includes(file.type)) {
      setMessage("Upload a PDF, JPG, PNG, or WebP document."); return;
    }

    setBusy(true); setMessage("");
    let proofDocumentPath:string|null=null;
    if (file) {
      const safeName=file.name.toLowerCase().replace(/[^a-z0-9._-]+/g,"-").slice(-90);
      proofDocumentPath=session.user.id+"/"+crypto.randomUUID()+"-"+safeName;
      const {error:uploadError}=await supabase.storage.from("profile-claim-proofs").upload(proofDocumentPath,file,{upsert:false,contentType:file.type});
      if(uploadError) { setMessage("Document upload failed. Check the file and try again."); setBusy(false); return; }
    }
    const {error}=await supabase.from("profile_claim_requests").insert({
      entity_type:entityType, entity_id:entityId, requester_id:session.user.id,
      organization_email:normalizedEmail || null,
      verification_method:proofDocumentPath ? "document" : "official_email",
      proof_document_path:proofDocumentPath, status:"pending"
    });
    if(error) setMessage(error.code==="23505" ? "A claim request for this profile is already pending." : "Unable to submit the claim. Please try again.");
    else {
      setMessage("Claim submitted. HoopCheck admins will review the evidence.");
      setOpen(false); setEmail(""); setFile(null);
    }
    setBusy(false);
  }

  if (!eligibilityChecked || !eligible) return null;
  return <div className="hc-claim-control">
    <button type="button" className="hc-claim-trigger" onClick={()=>{setMessage("");setOpen(value=>!value);}}>
      <span aria-hidden="true">✓</span> {entityType === "team" ? "Claim Your Team" : "Claim This Profile"}
    </button>
    {open&&<div className="hc-claim-panel">
      <div className="hc-claim-panel__heading"><div><p className="eyebrow">TEAM / ORGANIZATION VERIFICATION</p><h3>Claim {entityName}</h3></div><button type="button" aria-label="Close claim form" onClick={()=>setOpen(false)}>×</button></div>
      <p>Complete the verification steps below. A claim never gives an organization permission to edit or remove player reviews.</p>
      <ol className="hc-claim-steps" aria-label="Three steps to claim this profile">
        <li className="is-current"><span>1</span><div><strong>Identify the organization</strong><small>Confirm you are claiming {entityName} as an authorized representative.</small></div></li>
        <li className="is-current"><span>2</span><div><strong>Submit verification details</strong><small>Provide your official organization email. Add a supporting document if available.</small></div></li>
        <li><span>3</span><div><strong>HoopCheck review</strong><small>An admin checks your evidence and updates the claim status.</small></div></li>
      </ol>
      <label className="hc-claim-field">Official organization email
        <input type="email" value={email} onChange={event=>setEmail(event.target.value)} placeholder="name@club-domain.com" autoComplete="email" />
      </label>
      <label className="hc-claim-field">Supporting document (optional)
        <input type="file" accept=".pdf,image/jpeg,image/png,image/webp" onChange={event=>setFile(event.target.files?.[0]||null)} />
        <small>PDF, JPG, PNG, or WebP · max 10 MB · stored privately</small>
      </label>
      {message&&<p className="hc-claim-message" role="status">{message}</p>}
      <button type="button" className="btn" disabled={busy} onClick={()=>void submit()}>{busy?"Submitting…":"Submit for Admin Review"}</button>
    </div>}
    {!open&&message&&<small className="hc-claim-message" role="status">{message}</small>}
  </div>;
}
