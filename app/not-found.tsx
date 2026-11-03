import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-shell" style={{ minHeight: "52vh", display: "grid", placeItems: "center", padding: "48px 16px" }}>
      <section className="card" style={{ width: "100%", maxWidth: 620, padding: "clamp(24px, 5vw, 48px)", textAlign: "center" }}>
        <p className="eyebrow">HOOPCHECK / 404</p>
        <h1>This page could not be found</h1>
        <p className="muted">The link may be outdated, or this page may have moved.</p>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
          <Link href="/" className="btn">Back to Home</Link>
        </div>
      </section>
    </main>
  );
}
