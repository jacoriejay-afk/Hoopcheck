"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

type Request = {
  id: string; requester_id: string; player_id: string;
  message: string | null; status: string; created_at: string;
};
type Message = {
  id: string; request_id: string; sender_id: string;
  body: string; created_at: string;
};
type Contact = { id: string; display_name: string | null; username: string | null };

export default function HoopChatInbox() {
  const [userId, setUserId] = useState("");
  const [requests, setRequests] = useState<Request[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) { setError("Could not verify your session."); setLoading(false); return; }
    if (!user) { setLoading(false); return; }
    setUserId(user.id);
    const { data: requestRows, error: requestsError } = await supabase
      .from("player_contact_requests")
      .select("id,requester_id,player_id,message,status,created_at")
      .or(`requester_id.eq.${user.id},player_id.eq.${user.id}`)
      .order("created_at", { ascending: false }).limit(100);
    if (requestsError) { setError("Conversations could not be loaded."); setLoading(false); return; }
    const rows = (requestRows || []) as Request[];
    setRequests(rows);
    setSelectedId(current => rows.some(row => row.id === current) ? current : (rows[0]?.id || null));
    const accepted = rows.filter(row => row.status === "accepted").map(row => row.id);
    const peers = [...new Set(rows.map(row => row.requester_id === user.id ? row.player_id : row.requester_id))];
    const [messageResult, contactResult] = await Promise.all([
      accepted.length ? supabase.from("player_contact_messages")
        .select("id,request_id,sender_id,body,created_at").in("request_id", accepted)
        .order("created_at", { ascending: false }).limit(500)
        : Promise.resolve({ data: [] as Message[], error: null }),
      peers.length ? supabase.from("profiles").select("id,display_name,username").in("id", peers)
        : Promise.resolve({ data: [] as Contact[], error: null }),
    ]);
    // Requests and message access stay governed by the existing HoopChat RLS policies.
    if (messageResult.error) setError("Some message histories could not be loaded.");
    else setMessages((messageResult.data || []) as Message[]);
    setContacts(Object.fromEntries(((contactResult.data || []) as Contact[]).map(item => [item.id, item])));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const sorted = useMemo(() => [...requests].sort((a, b) => {
    const aLast = messages.find(message => message.request_id === a.id)?.created_at || a.created_at;
    const bLast = messages.find(message => message.request_id === b.id)?.created_at || b.created_at;
    return bLast.localeCompare(aLast);
  }), [requests, messages]);
  const selected = requests.find(row => row.id === selectedId) || null;
  const activeMessages = messages.filter(message => message.request_id === selectedId).slice().reverse();
  const peerId = (request: Request) => request.requester_id === userId ? request.player_id : request.requester_id;
  const peerName = (request: Request) => {
    const contact = contacts[peerId(request)];
    return contact?.display_name?.trim() || (contact?.username ? "@" + contact.username : "HoopCheck member");
  };

  async function respond(status: "accepted" | "rejected") {
    if (!selected || selected.player_id !== userId || selected.status !== "pending") return;
    setSending(true); setError("");
    const { error: updateError } = await supabase.from("player_contact_requests")
      .update({ status, responded_at: new Date().toISOString() })
      .eq("id", selected.id).eq("player_id", userId).eq("status", "pending");
    if (updateError) setError("Could not update this request.");
    else await load();
    setSending(false);
  }

  async function send() {
    if (!selected || !userId || selected.status !== "accepted" || !draft.trim() || sending) return;
    setSending(true); setError("");
    const { error: sendError } = await supabase.from("player_contact_messages").insert({
      request_id: selected.id, sender_id: userId, body: draft.trim().slice(0, 2000),
    });
    if (sendError) setError("Your message could not be sent.");
    else { setDraft(""); await load(); }
    setSending(false);
  }

  if (loading) return <p role="status" className="muted">Loading private conversations…</p>;
  if (!userId) return <p>Sign in to view your messages. <Link href="/login?returnTo=%2Fnotifications%3Ftab%3Dmessages">Sign in</Link></p>;

  return <section className="hc-message-inbox" aria-label="HoopChat message threads">
    <div className="hc-message-inbox__intro"><div><p className="eyebrow">HOOPCHAT</p><h2>Messages & requests</h2><p className="muted">Only accepted player contacts can exchange private messages.</p></div><button className="btn dark" type="button" onClick={() => void load()}>Refresh threads</button></div>
    {error && <p role="alert">{error}</p>}
    {sorted.length ? <div className="hc-message-inbox__layout">
      <nav className="hc-message-inbox__list" aria-label="Conversations">
        {sorted.map(row => {
          const last = messages.find(message => message.request_id === row.id);
          return <button key={row.id} type="button" className={"hc-message-inbox__thread" + (row.id === selectedId ? " is-selected" : "")} onClick={() => { setSelectedId(row.id); setDraft(""); }} aria-current={row.id === selectedId ? "true" : undefined}>
            <strong>{peerName(row)}</strong><small>{row.status === "pending" ? (row.player_id === userId ? "Incoming request" : "Request pending") : row.status === "accepted" ? "Conversation" : "Request " + row.status}</small>
            <span>{last?.body || row.message || "No messages yet"}</span>
          </button>;
        })}
      </nav>
      <div className="hc-message-inbox__conversation">
        {selected ? <>
          <header><div><strong>{peerName(selected)}</strong><small>{selected.status === "accepted" ? "Private HoopChat" : "Contact request"}</small></div><Link href={`/players/${peerId(selected)}`}>View player</Link></header>
          <div className="hc-message-inbox__history" role="log" aria-label="Message history">
            {selected.message && <p className="hc-message-inbox__request">Introduction: {selected.message}</p>}
            {activeMessages.map(message => <article key={message.id} className={"hc-message-inbox__bubble" + (message.sender_id === userId ? " is-mine" : "")}><strong>{message.sender_id === userId ? "You" : peerName(selected)}</strong><p>{message.body}</p><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString()}</time></article>)}
            {selected.status === "accepted" && !activeMessages.length && <p className="muted">Your connection is accepted. Start the conversation below.</p>}
          </div>
          {selected.status === "accepted" ? <form onSubmit={event => { event.preventDefault(); void send(); }} className="hc-message-inbox__composer"><label htmlFor="hc-hoopchat-draft">Write a private message</label><textarea id="hc-hoopchat-draft" value={draft} maxLength={2000} rows={3} placeholder="Write a message…" onChange={event => setDraft(event.target.value)} /><button type="submit" className="btn" disabled={sending || !draft.trim()}>{sending ? "Sending…" : "Send message"}</button></form>
          : selected.status === "pending" && selected.player_id === userId ? <div className="actions"><button type="button" className="btn" disabled={sending} onClick={() => void respond("accepted")}>Accept request</button><button type="button" className="btn dark" disabled={sending} onClick={() => void respond("rejected")}>Decline</button></div>
          : <p className="muted">Messaging is locked until the player accepts this request.</p>}
        </> : <p className="muted">Choose a conversation to read its messages.</p>}
      </div>
    </div> : <div className="hc-alerts-empty" role="status"><strong>No conversations yet</strong><p>Messages and contact requests will appear here.</p><Link href="/players">Browse players</Link></div>}
  </section>;
}
