"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function AcceptTeamInvitationPage() {
  const [invitationId, setInvitationId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [clubId, setClubId] = useState("");

  async function accept(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !UUID.test(invitationId.trim())) {
      setMessage("Enter a valid invitation ID.");
      return;
    }
    setBusy(true);
    setMessage("");
    setClubId("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sign in with the email address that received the invitation.");
      const response = await fetch("/api/team-hq/invitations/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.access_token,
        },
        body: JSON.stringify({ invitationId: invitationId.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Invitation could not be accepted.");
      setClubId(result.clubId);
      setMessage("Invitation accepted. Your manager access is active for this club.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invitation could not be accepted.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="page-shell"><div className="page-container">
    <section className="dashboard-card" style={{ marginTop: 20 }}>
      <p className="eyebrow">HOOPCHECK · TEAM HQ</p>
      <h1>Accept a club invitation</h1>
      <p className="muted">Sign in with your verified invited email. Invitations expire after seven days and can only be accepted once.</p>
      <form onSubmit={accept}>
        <label className="hc-claim-field">Invitation ID
          <input required value={invitationId} onChange={event => setInvitationId(event.target.value)}
            placeholder="Paste your invitation ID" autoComplete="off" />
        </label>
        <button className="btn" type="submit" disabled={busy}>{busy ? "Verifying…" : "Accept invitation"}</button>
      </form>
      {message && <p role="status">{message}</p>}
      {clubId && <Link className="btn dark" href="/team-dashboard">Open Team HQ</Link>}
    </section>
  </div></main>;
}
