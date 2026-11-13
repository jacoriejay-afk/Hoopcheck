"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type Club = { id: string; name: string };
type Access = { allowed: boolean; role?: string; capabilities?: { manageStaff?: boolean } };
type StaffMember = { userId: string; joinedAt: string };

export default function TeamStaffPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubId, setClubId] = useState("");
  const [access, setAccess] = useState<Access | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [invitationId, setInvitationId] = useState("");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [revokeId, setRevokeId] = useState("");

  useEffect(() => {
    let live = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (live) setMessage("Sign in to manage club staff."); return; }
      const { data, error } = await supabase.from("profile_claim_requests")
        .select("entity_id").eq("requester_id", user.id)
        .eq("entity_type", "team").eq("status", "approved");
      if (!live) return;
      if (error) { setMessage("Club claims could not be loaded."); return; }
      const ids = Array.from(new Set((data || []).map(row => row.entity_id)));
      if (!ids.length) { setMessage("An approved club claim is required."); return; }
      const result = await supabase.from("teams").select("id,name").in("id", ids).order("name");
      if (!live) return;
      if (result.error) { setMessage("Clubs could not be loaded."); return; }
      setClubs((result.data || []) as Club[]);
      setClubId(result.data?.[0]?.id || "");
    })();
    return () => { live = false; };
  }, []);

  useEffect(() => {
    let live = true;
    setAccess(null);
    setStaff([]);
    setInvitationId("");
    if (!clubId) return;
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { if (live) setMessage("Sign in to manage staff."); return; }
      const response = await fetch("/api/team-hq/access?clubId=" + encodeURIComponent(clubId), {
        headers: { Authorization: "Bearer " + session.access_token }, cache: "no-store",
      });
      const verified = response.ok ? await response.json() as Access : { allowed: false };
      if (!live) return;
      setAccess(verified);
      if (verified.capabilities?.manageStaff) {
        const rosterResponse = await fetch("/api/team-hq/staff?clubId=" + encodeURIComponent(clubId), {
          headers: { Authorization: "Bearer " + session.access_token }, cache: "no-store",
        });
        if (!live) return;
        if (rosterResponse.ok) {
          const roster = await rosterResponse.json();
          setStaff((roster.staff || []) as StaffMember[]);
        } else setMessage("Active managers could not be loaded.");
      }
    })();
    return () => { live = false; };
  }, [clubId]);

  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!access?.capabilities?.manageStaff || busy) return;
    setBusy(true); setMessage(""); setInvitationId("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sign in required.");
      const response = await fetch("/api/team-hq/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ clubId, email: email.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Invitation failed.");
      setInvitationId(result.invitationId);
      setEmail("");
      setMessage("Invitation created. Share the invitation ID securely with the intended manager. It expires after seven days.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invitation failed.");
    } finally { setBusy(false); }
  }

  async function revoke(member: StaffMember) {
    if (busy || !access?.capabilities?.manageStaff || !window.confirm("Revoke this manager's access to this club?")) return;
    setBusy(true); setRevokeId(member.userId); setMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sign in required.");
      const response = await fetch("/api/team-hq/staff/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ clubId, targetUserId: member.userId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not revoke manager.");
      setStaff(current => current.filter(item => item.userId !== member.userId));
      setMessage("Manager access revoked for this club.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not revoke manager.");
    } finally { setBusy(false); setRevokeId(""); }
  }

  return <main className="page-shell"><div className="page-container">
    <Link href="/team-dashboard">Team HQ</Link>
    <section className="dashboard-card" style={{ marginTop: 16 }}>
      <h1>Club staff</h1>
      <p className="muted">Only approved club owners can invite managers. Invitations expire after seven days.</p>
      {clubs.length > 1 && <label className="hc-claim-field">Club
        <select value={clubId} onChange={event => setClubId(event.target.value)}>
          {clubs.map(club => <option key={club.id} value={club.id}>{club.name}</option>)}
        </select>
      </label>}
      {clubId && access === null && <p role="status">Checking club permissions…</p>}
      {access && !access.capabilities?.manageStaff && <p role="status">Staff management requires an approved owner claim for this club.</p>}
      {access?.capabilities?.manageStaff && <form onSubmit={invite}>
        <label className="hc-claim-field">Manager email
          <input type="email" required maxLength={254} value={email}
            onChange={event => setEmail(event.target.value)} autoComplete="email"
            placeholder="manager@example.com" />
        </label>
        <button className="btn" type="submit" disabled={busy}>{busy ? "Creating…" : "Create invitation"}</button>
      </form>}
      {access?.capabilities?.manageStaff && <section aria-label="Active club managers" style={{ marginTop: 24 }}>
        <h2>Active managers</h2>
        {staff.length === 0 && <p className="muted">No active invited managers.</p>}
        {staff.map(member => <div key={member.userId} className="dashboard-card" style={{ marginTop: 12, padding: 12 }}>
          <p><strong>Manager ID:</strong> <code>{member.userId}</code></p>
          <p className="muted">Accepted {new Date(member.joinedAt).toLocaleDateString()}</p>
          <button type="button" className="btn dark" disabled={busy}
            onClick={() => void revoke(member)}>{revokeId === member.userId ? "Revoking…" : "Revoke access"}</button>
        </div>)}
      </section>}
      {message && <p role="status">{message}</p>}
      {invitationId && <p>Invitation ID: <code>{invitationId}</code></p>}
    </section>
  </div></main>;
}
