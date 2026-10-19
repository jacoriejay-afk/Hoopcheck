import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "96px 24px", textAlign: "center" }}>
      <p className="eyebrow">HOOPCHECK / 404</p>
      <h1>Looks like this page is out of bounds.</h1>
      <p className="muted">The link may be outdated, or the page may have been removed.</p>
      <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
        <Link href="/" className="btn">Back to HoopCheck</Link>
      </div>
    </main>
  );
}
