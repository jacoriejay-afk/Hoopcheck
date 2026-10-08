"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type RequestType = "access" | "correction" | "deletion" | "export" | "privacy_question";

const labels: Record<RequestType,string> = {
  access: "Access my data",
  correction: "Correct my data",
  deletion: "Request data deletion",
  export: "Export my data",
  privacy_question: "Privacy question",
};

export default function PrivacyCenterPage() {
  const [userId,setUserId] = useState<string|null>(null);
  const [type,setType] = useState<RequestType>("access");
  const [details,setDetails] = useState("");
  const [requests,setRequests] = useState<any[]>([]);
  const [loading,setLoading] = useState(true);
  const [submitting,setSubmitting] = useState(false);
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href="/login"; return; }
    setUserId(user.id);
    const { data, error: requestError } = await supabase.from("privacy_requests")
      .select("id,request_type,status,details,created_at,updated_at,completed_at")
      .eq("requester_id",user.id).order("created_at",{ascending:false});
    if (requestError) setError("We couldn't load your privacy requests.");
    else setRequests(data ?? []);
    setLoading(false);
  }

  useEffect(()=>{ void load(); },[]);

  async function submit() {
    setSubmitting(true); setError(""); setMessage("");
    if (!details.trim()) { setError("Please describe what you need."); setSubmitting(false); return; }
    const { error: insertError } = await supabase.from("privacy_requests").insert({
      requester_id:userId, request_type:type, details:details.trim()
    });
    if (insertError) setError("We couldn't submit your request. Please try again.");
    else { setMessage("Your privacy request was submitted."); setDetails(""); await load(); }
    setSubmitting(false);
  }

  return <main>
    <section className="hero">
      <div className="eyebrow">HoopCheck Privacy</div>
      <h1>Privacy<br />Request Center.</h1>
      <p>Request access, correction, deletion, or a copy of personal information associated with your HoopCheck account.</p>
    </section>

    <section className="legal-content">
      <div className="legal-card">
        {message && <div className="status success">{message}</div>}
        {error && <div className="status error">{error}</div>}

        <h2>Make a request</h2>
        <p>Choose the request that best describes what you need. HoopCheck may ask for reasonable information to verify your identity before completing a request.</p>

        <label>Request type</label>
        <select value={type} onChange={e=>setType(e.target.value as RequestType)} style={{width:"100%",margin:"8px 0 16px"}}>
          {Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select>

        <label>Details</label>
        <textarea value={details} onChange={e=>setDetails(e.target.value)} maxLength={5000} placeholder="Tell us what information or action you are requesting." style={{width:"100%",minHeight:140,marginTop:8}} />
        <button className="btn" onClick={submit} disabled={submitting}>{submitting ? "Submitting..." : "Submit privacy request"}</button>

        <h2 style={{marginTop:36}}>Your requests</h2>
        {loading ? <p>Loading...</p> : requests.length === 0 ? <p className="muted">You have not submitted a privacy request.</p> :
          <div>{requests.map(r=><div key={r.id} className="dashboard-card" style={{marginBottom:10}}>
            <strong>{labels[r.request_type as RequestType] ?? r.request_type}</strong>
            <div className="muted">{new Date(r.created_at).toLocaleString()} · Status: {r.status.replaceAll("_"," ")}</div>
            <p>{r.details}</p>
          </div>)}</div>
        }

        <div className="legal-footer">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/account">Account</Link>
          <Link href="/support">Support</Link>
        </div>
      </div>
    </section>
  </main>;
}