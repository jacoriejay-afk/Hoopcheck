"use client";
import Link from "next/link";
import { useState } from "react";
import { useAuthState } from "../../components/AuthProvider";
import styles from "./links.module.css";

export function BioLinkControls() {
  const [status, setStatus] = useState("");
  async function share() {
    const url = new URL("/links", window.location.origin).href;
    setStatus("");
    try {
      if (navigator.share) {
        try { await navigator.share({ title: "HoopCheck™", url }); return; }
        catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; }
      }
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setStatus("Link copied.");
    } catch { setStatus("Copy this page’s address from your browser."); }
  }
  return <div className={styles.shareWrap}><button className={styles.share} type="button" onClick={share} aria-label="Share HoopCheck links"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m-4 4 4-4 4 4M5 11v9h14v-9"/></svg> Share</button><span role="status" className={styles.status}>{status}</span></div>;
}

const tabs = [
  { label: "Home", href: "/", path: "M3 10 12 3l9 7M5.5 9v11h13V9M9.5 20v-6h5v6" },
  { label: "HoopFeed", href: "/feed", path: "M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0M3.5 9h17M3.5 15h17M12 3c6 6 6 12 0 18M12 3c-6 6-6 12 0 18" },
  { label: "Search", href: "/search", path: "M4 10.5a6.5 6.5 0 1 0 13 0 6.5 6.5 0 1 0-13 0m11.5 5 5 5" },
  { label: "Alerts", href: "/notifications", path: "M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" },
  { label: "Account", href: "/login", path: "M8.5 7.5a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0M4.5 21c.4-4.4 3-6.7 7.5-6.7s7.1 2.3 7.5 6.7Z" },
];
export function GuestBioNavigation() {
  const { signedIn } = useAuthState();
  if (signedIn) return null; // The global BottomNav already serves signed-in users.
  return <nav className={styles.guestNav} aria-label="Quick navigation">{tabs.map(tab => <Link key={tab.href} href={tab.href}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={tab.path}/></svg><span>{tab.label}</span></Link>)}</nav>;
}
