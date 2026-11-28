"use client";

import HoopLoading from "../../components/HoopLoading";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type RequestType = "access" | "correction" | "deletion" | "export" | "privacy_question";

const labels: Record<RequestType,string> = {
  access: "Access my data",
  correction: "Correct my data",
  deletion: "Request data deletion",
  export: "Export my data",
  privacy_question: "Privacy question",
};

type PrivacyRequest = { id: string; request_type: RequestType; status: string; details: string; created_at: string };

async function verifiedPrivacyToken(owner: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error || data.session?.user.id !== owner) throw Error("Account changed.");
  const token = data.session.access_token;
  const verified = await supabase.auth.getUser(token);
  if (verified.error || verified.data.user?.id !== owner) throw Error("Account changed.");
  return token;
}

export default function PrivacyCenterPage() {
  const router = useRouter();
  const [userId,setUserId] = useState<string|null>(null);
  const [type,setType] = useState<RequestType>("access");
  const [details,setDetails] = useState("");
  const [requests,setRequests] = useState<PrivacyRequest[] | null>(null);
  const [loading,setLoading] = useState(true);
  const [submitting,setSubmitting] = useState(false);
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");
  const [uncertain,setUncertain] = useState(false);
  const [refresh,setRefresh] = useState(0);
  const inFlight = useRef(false);
  const current = useRef<{ owner: string | null; generation: number }>({ owner: null, generation: 0 });

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const owner = session?.user.id ?? null;
      if (current.current.owner !== owner || event === "SIGNED_OUT") {
        current.current = { owner, generation: current.current.generation + 1 };
        setRequests(null);
        setDetails("");
        setMessage("");
        setError("");
        setUncertain(false);
        setLoading(true);
        setUserId(owner);
      }
      if (!owner) router.replace("/login?returnTo=%2Fprivacy-center");
    });
    return () => {
      data.subscription.unsubscribe();
      current.current = { owner: null, generation: current.current.generation + 1 };
    };
  }, [router]);

  useEffect(() => {
    if (!userId) return;
    const scope = current.current;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let live = true;
    const ownsRead = () => live && current.current === scope;
    async function load(owner: string) {
      setLoading(true);
      try {
        const token = await verifiedPrivacyToken(owner);
        if (!ownsRead()) return;
        const { data, error: requestError } = await supabase.from("privacy_requests")
          .select("id,request_type,status,details,created_at")
          .eq("requester_id", owner)
          .order("created_at", { ascending: false })
          .setHeader("Authorization", "Bearer " + token).abortSignal(controller.signal);
        if (requestError || controller.signal.aborted) throw Error("Read unavailable.");
        await verifiedPrivacyToken(owner);
        if (controller.signal.aborted) throw Error("Read unavailable.");
        if (ownsRead()) {
          setRequests(data ?? []);
          setUncertain(false);
        }
      } catch {
        if (ownsRead()) setError("We couldn't load your privacy requests. Please try again.");
      } finally {
        clearTimeout(timeout);
        if (ownsRead()) setLoading(false);
      }
    }
    void load(userId);
    return () => {
      live = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [userId, refresh]);

  async function submit() {
    if (inFlight.current || uncertain || !userId) return;
    const scope = current.current;
    if (scope.owner !== userId) return;
    const cleanDetails = details.trim();
    if (cleanDetails.length < 10 || cleanDetails.length > 5000) {
      setError("Please describe your request in 10–5,000 characters.");
      setMessage("");
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const token = await verifiedPrivacyToken(userId);
      if (current.current !== scope) return;
      const { error: insertError } = await supabase.from("privacy_requests").insert({
        requester_id: userId,
        request_type: type,
        details: cleanDetails,
      }).setHeader("Authorization", "Bearer " + token);
      if (insertError) throw insertError;
      await verifiedPrivacyToken(userId);
      if (current.current !== scope) return;
      setMessage("Your privacy request was submitted.");
      setDetails("");
      setRefresh(value => value + 1);
    } catch {
      if (current.current === scope) {
        setUncertain(true);
        setError("Submission could not be confirmed. Refresh your requests before trying again.");
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return <main className="hc-legal-page hc-privacy-center-page">
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
        <textarea value={details} onChange={e=>setDetails(e.target.value)} minLength={10} maxLength={5000} aria-label="Privacy request details" placeholder="Tell us what information or action you are requesting." style={{width:"100%",minHeight:140,marginTop:8}} />
        <button className="btn" onClick={submit} disabled={submitting || uncertain || !userId}>{submitting ? "Submitting..." : "Submit privacy request"}</button>

        <h2 style={{marginTop:36}}>Your requests</h2>
        <button className="btn" disabled={!userId || loading || submitting} onClick={() => { setError(""); setRefresh(value => value + 1); }}>Refresh requests</button>
        {loading ? <HoopLoading variant="inline" label="Loading..." /> : requests === null ? null : requests.length === 0 ? <p className="muted">You have not submitted a privacy request.</p> :
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
