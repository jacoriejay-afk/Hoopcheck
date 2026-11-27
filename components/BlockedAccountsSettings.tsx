"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthState } from "./AuthProvider";
import { supabase } from "../lib/supabase";
import { readWithDeadline } from "../apps/mobile/src/native/readDeadline";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const timeoutMs = 12000;
type BlockedAccount = { id: string; name: string };

async function accountBearer(userId: string, signal: AbortSignal) {
  const { data: { session }, error } = await readWithDeadline(() => supabase.auth.getSession(), timeoutMs);
  if (error || session?.user.id !== userId || signal.aborted) throw new Error("Your session changed.");
  return "Bearer " + session.access_token;
}

export default function BlockedAccountsSettings() {
  const { userId } = useAuthState();
  if (!userId) return null;
  return <BlockedAccountList key={userId} userId={userId} />;
}

function BlockedAccountList({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const [accounts, setAccounts] = useState<BlockedAccount[] | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const mutation = useRef<AbortController | null>(null);

  useEffect(() => () => {
    mutation.current?.abort();
    mutation.current = null;
  }, []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const controller = new AbortController();
    const { signal } = controller;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    setAccounts(null);
    setError("");
    async function load() {
      const bearer = await accountBearer(userId, signal);
      const blocks = await supabase.from("user_blocks").select("blocked_id").eq("blocker_id", userId)
        .order("blocked_id").limit(501).setHeader("Authorization", bearer).abortSignal(signal);
      if (blocks.error || !Array.isArray(blocks.data) || blocks.data.length > 500 ||
          blocks.data.some(row => typeof row.blocked_id !== "string" || !uuid.test(row.blocked_id))) {
        throw new Error("Blocked accounts could not be verified.");
      }
      const ids = blocks.data.map(row => row.blocked_id);
      const profiles = ids.length ? await supabase.from("profiles").select("id,display_name")
        .in("id", ids).setHeader("Authorization", bearer).abortSignal(signal) : null;
      const names = new Map((profiles?.data ?? []).map(row => [
        row.id, typeof row.display_name === "string" ? row.display_name.trim().slice(0, 200) : "",
      ]));
      await accountBearer(userId, signal);
      return ids.map(id => ({ id, name: names.get(id) || "Unavailable profile · " + id.slice(0, 8) }));
    }
    void load().then(rows => {
      if (active) setAccounts(rows);
    }).catch(() => {
      if (active) setError("Blocked accounts could not load. Try again.");
    }).finally(() => clearTimeout(timer));
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [open, revision, userId]);

  async function unblock(id: string) {
    if (mutation.current || id !== confirmation || id === userId || !accounts?.some(account => account.id === id)) return;
    const controller = new AbortController();
    const { signal } = controller;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    mutation.current = controller;
    setBusy(true);
    setStatus("");
    setError("");
    try {
      const bearer = await accountBearer(userId, signal);
      const result = await supabase.from("user_blocks").delete()
        .eq("blocker_id", userId).eq("blocked_id", id).select("blocked_id")
        .setHeader("Authorization", bearer).abortSignal(signal);
      if (result.error || result.data?.length !== 1 || result.data[0].blocked_id !== id) {
        throw new Error("Unblock could not be confirmed.");
      }
      await accountBearer(userId, signal);
      if (mutation.current !== controller) return;
      setAccounts(rows => rows?.filter(account => account.id !== id) ?? null);
      setStatus("Account unblocked.");
    } catch {
      if (mutation.current !== controller) return;
      setAccounts(null);
      setError("Unblock could not be confirmed. Refresh before trying again.");
    } finally {
      clearTimeout(timer);
      if (mutation.current === controller) {
        mutation.current = null;
        setConfirmation(null);
        setBusy(false);
      }
    }
  }

  return <section id="blocked-accounts" className="settings-card" aria-labelledby="blocked-accounts-title">
    <h2 id="blocked-accounts-title">Blocked accounts</h2>
    <details onToggle={event => {
      setOpen(event.currentTarget.open);
      if (!event.currentTarget.open) { setConfirmation(null); setStatus(""); }
    }}>
      <summary>Manage blocked accounts</summary>
      {open && <div>
        {error ? <p role="alert">{error}</p> : !accounts ? <p role="status">Loading blocked accounts…</p>
          : !accounts.length ? <p>No blocked accounts.</p> : <ul>
            {accounts.map(account => <li key={account.id}>
              <p>{account.name}</p>
              {confirmation === account.id ? <>
                <p>Unblock this account?</p>
                <button className="btn" type="button" disabled={busy} onClick={() => void unblock(account.id)}>Confirm unblock</button>
                <button className="btn dark" type="button" disabled={busy} onClick={() => setConfirmation(null)}>Cancel</button>
              </> : <button className="btn" type="button" disabled={busy} aria-label={"Unblock " + account.name}
                onClick={() => setConfirmation(account.id)}>Unblock</button>}
            </li>)}
          </ul>}
        {status && <p role="status">{status}</p>}
        <button className="btn dark" type="button" disabled={busy} onClick={() => {
          setConfirmation(null);
          setStatus("");
          setRevision(value => value + 1);
        }}>Refresh blocked accounts</button>
      </div>}
    </details>
  </section>;
}
