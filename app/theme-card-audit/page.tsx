import type { Metadata } from "next";
import { HoopIcon } from "../../components/HoopCheckUI";

export const metadata: Metadata = {
  title: "Theme Card Audit | HoopCheck",
  robots: { index: false, follow: false },
};

function HubThemeColumn({ theme }: { theme: "light" | "dark" }) {
  return (
    <section className="hc-card-audit-preview" data-theme-preview={theme} aria-label={theme + " theme preview"}>
      <header className="hc-card-audit-heading">
        <p className="eyebrow">LIVE GAME HUB · CARD-3 COVERAGE</p>
        <h2>{theme === "dark" ? "Dark theme" : "Light theme"}</h2>
        <p className="muted">Empty states, count badges, filter surface and populated game card.</p>
      </header>

      <section className="hc-card-audit-section">
        <div className="hc-live-section-heading">
          <div><p className="eyebrow">RIGHT NOW</p><h2>LIVE NOW <span>0</span></h2></div>
        </div>
        <div className="hc-live-empty">
          <div className="hc-live-empty__icon"><HoopIcon name="basketball" size={24} /></div>
          <div><h3>No live games right now</h3><p>When a game is live, its chat will appear here.</p></div>
        </div>
      </section>

      <section className="hc-card-audit-section">
        <div className="hc-live-section-heading">
          <div><p className="eyebrow">NEXT UP</p><h2>UPCOMING <span>0</span></h2></div>
        </div>
        <div className="hc-live-empty">
          <div className="hc-live-empty__icon"><HoopIcon name="calendar" size={24} /></div>
          <div><h3>No confirmed upcoming games</h3><p>Confirmed fixtures will appear here when available.</p></div>
        </div>
      </section>

      <section className="hc-card-audit-section">
        <div className="hc-live-section-heading">
          <div><p className="eyebrow">FINAL WHISTLE</p><h2>RECENTLY FINISHED <span>0</span></h2></div>
        </div>
        <div className="hc-live-recent-empty">Recent final scores will appear here when available.</div>
      </section>

      <section className="hc-card-audit-section">
        <div className="hc-live-hub-filters">
          <strong>Filter games</strong>
          <p className="muted">All games · Live only · My teams</p>
        </div>
      </section>

      <section className="hc-card-audit-section">
        <article className="hc-live-hub-card">
          <div className="hc-live-card__top"><strong>Sumqayit BK · vs · Baku Falcons</strong><span className="hc-live-state">UPCOMING</span></div>
          <p className="muted">National League · Sample fixture</p>
          <div className="hc-live-card__actions"><span>Chat opens before tip-off</span></div>
        </article>
      </section>
    </section>
  );
}

export default function ThemeCardAuditPage() {
  return (
    <main className="page-shell hc-card-audit-page">
      <div className="page-container">
        <header className="hc-card-audit-heading">
          <p className="eyebrow">INTERNAL VISUAL REGRESSION CHECK</p>
          <h1>Card Theme Audit</h1>
          <p className="muted">HUB-1 component inventory: empty-state card, icon chip, zero count badge, filter card and populated game card.</p>
        </header>
        <div className="hc-card-audit-grid">
          <HubThemeColumn theme="light" />
          <HubThemeColumn theme="dark" />
        </div>
      </div>
    </main>
  );
}
