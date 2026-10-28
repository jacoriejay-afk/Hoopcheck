"use client";

import { useState } from "react";
import TrustScoreDial from "./TrustScoreDial";
import { HoopCheckDraw, MotionNumber, MotionSwoosh, PlayerCardSkeletons, usePullToRefresh } from "./HoopMotion";

export default function MotionPreviewClient() {
  const [checksVisible, setChecksVisible] = useState(false);
  const [swoosh, setSwoosh] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const { pullToRefreshProps, pullIndicator } = usePullToRefresh(() => {
    setRefreshCount(value => value + 1);
    return new Promise(resolve => window.setTimeout(resolve, 650));
  });
  return <main className="hc-motion-preview page-container">
    <MotionSwoosh active={swoosh} />
    <header><p className="eyebrow">INTERNAL MOTION QA</p><h1>Shared Motion System</h1><p>CI-only motion proof. Shared production components, reduced-motion aware.</p></header>
    <section className="hc-motion-preview-grid">
      <article className="dashboard-card"><h2>1 · Trust Score reveal</h2><TrustScoreDial score={82} explanation="Verified player experiences" reviewCount={27} verifiedReviewCount={21}/></article>
      <article className="dashboard-card"><h2>2 · Confirmation check</h2><button className="btn" onClick={() => setChecksVisible(value => !value)}>{checksVisible ? "Hide confirmations" : "Reveal confirmations"}</button>{checksVisible && <div className="hc-motion-preview-checks"><span><HoopCheckDraw label="Review submitted"/> Review submitted</span><span><HoopCheckDraw label="Profile verified"/> Profile verified</span><span><HoopCheckDraw label="Team claim confirmed"/> Team claim confirmed</span></div>}</article>
      <article className="dashboard-card"><h2>3 · Directory counters</h2><div className="hc-motion-preview-counts"><strong><MotionNumber value={1284} label="1,284 teams"/></strong><span>TEAMS</span><strong><MotionNumber value={96} label="96 leagues"/></strong><span>LEAGUES</span></div></article>
      <article className="dashboard-card"><h2>4 · Pull to refresh</h2><p>Drag down from the top of this panel. Refreshes: <strong>{refreshCount}</strong></p><div className="hc-motion-preview-pull" {...pullToRefreshProps}>{pullIndicator}<div>Pull down from here</div></div></article>
      <article className="dashboard-card"><h2>5 · Main-tab swoosh</h2><button className="btn" onClick={() => { setSwoosh(true); window.setTimeout(() => setSwoosh(false), 460); }}>Play tab transition</button></article>
      <article className="dashboard-card"><h2>6 · Player-card skeleton shimmer</h2><PlayerCardSkeletons count={2}/></article>
    </section>
  </main>;
}
