import Link from "next/link";

export const metadata = { title: "Offline | HoopCheck", robots: { index: false, follow: false } };

export default function OfflinePage() {
  return (
    <main className="hc-offline-page">
      <section>
        <p className="eyebrow">HOOPCHECK · OFFLINE MODE</p>
        <h1>You’re off the court network.</h1>
        <p>Reconnect to load your latest clubs, players, reviews and community activity. Static app assets already saved on this device will remain available.</p>
        <Link href="/">Try again</Link>
      </section>
      <style>{`
        .hc-offline-page{min-height:100svh;display:grid;place-items:center;padding:24px;background:var(--hc-page-bg,#0a0a0a);color:var(--hc-foreground,#f5f5f0)}
        .hc-offline-page section{width:min(100%,520px);padding:24px;border:1px solid var(--hc-border,#333);border-radius:18px;background:var(--hc-surface-raised,#171717)}
        .hc-offline-page h1{font:700 clamp(28px,7vw,42px)/1.08 var(--font-sans),Arial,sans-serif;letter-spacing:-.03em;text-transform:none}
        .hc-offline-page p{line-height:1.6;color:var(--hc-foreground-muted,#aaa)}
        .hc-offline-page a{display:inline-flex;align-items:center;min-height:44px;padding:10px 16px;border-radius:10px;background:var(--hc-orange,#ff5a1f);font-weight:800;color:#111;text-decoration:none}
      `}</style>
    </main>
  );
}
