"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import UsernameField, { type UsernameFieldHandle } from "../../components/UsernameField";

export default function ChooseUsernamePage() {
  const router = useRouter();
  const [safeNext, setSafeNext] = useState("/dashboard");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fieldRef = useRef<UsernameFieldHandle>(null);

  useEffect(() => {
    let active = true;
    const requestedNext = new URLSearchParams(window.location.search).get("next") || "/dashboard";
    setSafeNext(requestedNext.startsWith("/") && !requestedNext.startsWith("//") && !requestedNext.includes("\\") && !requestedNext.startsWith("/login") ? requestedNext : "/dashboard");
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (!data.user) router.replace("/login");
      else setLoading(false);
    });
    return () => { active = false; };
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    const checked = await fieldRef.current?.validate();
    if (!checked?.valid) {
      setError("Username: " + (checked?.message || "Choose an available username."));
      fieldRef.current?.focus();
      setSaving(false);
      return;
    }
    const { error: saveError } = await supabase.rpc("save_my_username", { candidate_username: username.trim().toLowerCase() });
    if (saveError) {
      setError("Username: " + (saveError.message || "That username could not be saved."));
      fieldRef.current?.focus();
      setSaving(false);
      return;
    }
    router.replace(safeNext);
  }

  if (loading) return <main className="auth-page-shell"><section className="auth-card"><p>Checking your account…</p></section></main>;

  return (
    <main className="auth-page-shell">
      <section className="auth-card signup-card" style={{ maxWidth: 520, margin: "8vh auto", padding: 24 }}>
        <div className="eyebrow">ONE-TIME ACCOUNT SETUP</div>
        <h1>Choose your username</h1>
        <p className="muted">Your account is safe and you can keep using HoopCheck. Choose a username now, or skip and do it next time you sign in.</p>
        <form onSubmit={submit} className="signup-form">
          <UsernameField ref={fieldRef} value={username} onChange={setUsername} disabled={saving} />
          {error ? <div className="message error" role="alert">{error}</div> : null}
          <button className="btn submit" type="submit" disabled={saving}>{saving ? "Saving…" : "Save username"}</button>
          <button className="btn dark" type="button" onClick={() => router.replace(safeNext)} disabled={saving}>Skip for now</button>
        </form>
        <p className="muted" style={{ marginTop: 14 }}>Login always works with your email and password. <Link href="/dashboard">Continue to HoopCheck</Link></p>
      </section>
    </main>
  );
}
