"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Ticket = {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  description: string;
  created_at: string;
};

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("normal");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      setMessage("We couldn't verify your session. Please sign in again.");
      setLoading(false);
      return;
    }

    const user = session?.user;
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("support_tickets")
      .select("id,subject,category,priority,status,description,created_at")
      .eq("requester_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("Your tickets couldn't be loaded. Please refresh and try again.");
    } else {
      setTickets((data || []) as Ticket[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;

    const cleanSubject = subject.trim();
    const cleanDescription = description.trim();

    // Validate the exact values that will be stored, not whitespace-padded input.
    if (cleanSubject.length < 3 || cleanSubject.length > 160) {
      setMessage("Subject must be between 3 and 160 characters after removing extra spaces.");
      return;
    }
    if (cleanDescription.length < 10 || cleanDescription.length > 5000) {
      setMessage("Please describe the issue in 10–5,000 characters. Spaces at the beginning or end don't count.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        setMessage("We couldn't verify your session. Please sign in again.");
        return;
      }

      const user = session?.user;
      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { error } = await supabase.from("support_tickets").insert({
        requester_id: user.id,
        subject: cleanSubject,
        category,
        priority,
        description: cleanDescription,
      });

      if (error) {
        if (error.message.includes("support_tickets_description_check")) {
          setMessage("Please describe the issue in at least 10 characters, excluding leading and trailing spaces.");
        } else if (error.message.includes("support_tickets_subject_check")) {
          setMessage("Subject must be between 3 and 160 characters.");
        } else {
          setMessage("Your ticket couldn't be submitted. Please check the details and try again.");
        }
        return;
      }

      setSubject("");
      setDescription("");
      setCategory("general");
      setPriority("normal");
      setMessage("Ticket submitted. Your ticket is now in the HoopCheck support queue.");
      await load();
    } catch {
      setMessage("Something went wrong while submitting your ticket. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page-shell hc-support-page">
      <div className="page-container">
        <section className="hero-card">
          <div>
            <p className="eyebrow">HOOPCHECK SUPPORT</p>
            <h1>Open a support ticket.</h1>
            <p className="muted">
              Email: <a href="mailto:HoopCheck@outlook.com">HoopCheck@outlook.com</a>.
              Tickets create a trackable record for account, billing, verification,
              review, privacy, security, technical and team-directory issues.
            </p>
          </div>
        </section>

        <section className="dashboard-card" style={{ marginTop: 18 }}>
          <p className="eyebrow">NEW TICKET</p>
          <form onSubmit={submit} className="signup-form">
            <label>
              Subject
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                minLength={3}
                maxLength={160}
                required
              />
            </label>
            <div className="signup-two-col">
              <label>
                Category
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {["account", "billing", "verification", "review", "privacy", "security", "technical", "team_request", "general"].map((x) => (
                    <option key={x} value={x}>{x.replace("_", " ")}</option>
                  ))}
                </select>
              </label>
              <label>
                Priority
                <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
            </div>
            <label>
              Describe the issue
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                minLength={10}
                maxLength={5000}
                rows={7}
                required
              />
            </label>
            {message && <div className="message" role="status" aria-live="polite">{message}</div>}
            <button className="btn" disabled={saving}>
              {saving ? "Submitting..." : "Submit Ticket"}
            </button>
          </form>
        </section>

        <section className="dashboard-card" style={{ marginTop: 18 }}>
          <p className="eyebrow">MY TICKETS</p>
          {loading ? (
            <p className="muted">Loading...</p>
          ) : tickets.length === 0 ? (
            <p className="muted">No tickets yet.</p>
          ) : (
            <div className="grid" style={{ padding: "10px 0 0" }}>
              {tickets.map((ticket) => (
                <article className="card" key={ticket.id}>
                  <div className="eyebrow">{ticket.status} · {ticket.priority}</div>
                  <h3>{ticket.subject}</h3>
                  <p className="muted">{ticket.category}</p>
                  <p>{ticket.description}</p>
                  <small className="muted">{new Date(ticket.created_at).toLocaleString()}</small>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
