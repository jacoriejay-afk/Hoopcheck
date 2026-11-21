import Link from "next/link";
import { PageShell } from "../../components/LayoutSystem";
import ReelsViewer from "./ReelsViewer";
import "./reels.css";

/** Public launch stays off until moderation, reporting and physical-device
 * checks are accepted. The environment flag must be explicitly enabled at
 * build time for the public Reels viewer to become visible. */
export default function ReelsPage() {
  if (process.env.NEXT_PUBLIC_HOOPCHECK_REELS_ENABLED !== "true") {
    return <PageShell><main className="hc-reels-page">
      <header className="hc-reels-top"><div><p className="hc-reels-eyebrow">HOOPCHECK™</p><h1>Reels<span>.</span></h1></div><Link href="/feed" className="hc-reels-back">HoopFeed</Link></header>
      <section className="hc-reels-state" aria-label="Reels rollout status">
        <h2>Reels launch in preparation</h2>
        <p>Video browsing is being checked for playback, reporting, moderation and privacy before release.</p>
        <Link href="/feed" className="hc-reels-back">Return to HoopFeed</Link>
      </section>
    </main></PageShell>;
  }
  return <ReelsViewer />;
}
