import type { Metadata } from "next";
import CategoryTile from "../../components/CategoryTile";
import { HoopIcon } from "../../components/HoopCheckUI";
import PlayerProfilePanel from "../../components/PlayerProfilePanel";
import ReviewCard from "../../components/ReviewCard";
import Surface from "../../components/Surface";
import { Card, GroupCard } from "../../components/LayoutSystem";

export const metadata: Metadata = {
  title: "Theme Card Audit | HoopCheck",
  robots: { index: false, follow: false },
};

const contractSample = [{
  id: "audit-contract-1",
  team: "Northside Basketball",
  league: "National League",
  country: "United States",
  season: "2025–26",
  status: "Active" as const,
  games: 18,
  salary: null,
  currency: null,
  paymentStatus: "Verified",
  verified: true,
}];

const reviewSample = [{
  id: "audit-review-1",
  agent: "Jordan Smith",
  organization: "Player Representation",
  rating: 4.5,
  date: "Nov 2026",
  summary: "Clear communication and reliable support throughout the season.",
  verified: true,
}];

function ThemeColumn({ theme }: { theme: "light" | "dark" }) {
  return (
    <section className="hc-card-audit-preview" data-theme-preview={theme} aria-label={theme + " theme card preview"}>
      <header className="hc-card-audit-section">
        <h2>{theme.toUpperCase()} THEME</h2>
        <p className="muted">Semantic surface + paired foreground</p>
      </header>
      <section className="hc-card-audit-section">
        <h2>HOMEPAGE / DIRECTORY CARDS</h2>
        <div className="hc-card-audit-sample">
          <CategoryTile label="Men’s Teams" category="teams" href="/teams" description="Research teams before you sign" />
        </div>
      </section>
      <section className="hc-card-audit-section">
        <h2>CLUB PROFILE HERO</h2>
        <Surface as="section" className="hero hc-team-profile-hero">
          <p className="eyebrow">HOOPCHECK CLUB PROFILE</p>
          <h1>Northside Basketball</h1>
          <p className="muted">Orlando, United States · National League</p>
          <div className="hc-card-audit-sample"><strong>Reviews&nbsp;&nbsp; 12</strong><span> · Trust Score&nbsp;&nbsp; 84</span><span> · Followers&nbsp;&nbsp; 240</span></div>
          <button type="button" className="btn">Following</button>
        </Surface>
      </section>
      <section className="hc-card-audit-section">
        <h2>PLAYER PROFILE / DOSSIER</h2>
        <PlayerProfilePanel playerName="Alex Morgan" username="alexmorgan" position="Guard" nationality="United States" currentTeam="Northside Basketball" currentCountry="United States" seasonsPro={5} verifiedPlayer bio="Five seasons of professional basketball experience." contracts={contractSample} reviews={reviewSample} />
      </section>
      <section className="hc-card-audit-section">
        <h2>PLAYER PROFILE HERO</h2>
        <Surface as="section" className="hero-card player-profile-hero hc-player-profile-hero">
          <p className="eyebrow">PLAYER PROFILE</p><h2>Alex Morgan</h2><p className="muted">Guard · United States · 5 Pro Seasons</p><strong>Followers 120 · Reviews 8</strong>
        </Surface>
      </section>
      <section className="hc-card-audit-section">
        <h2>LIVE GAME HUB HERO</h2>
        <header className="hc-live-hub-hero"><div><p className="eyebrow">HOOPCHECK · LIVE GAME HUB</p><h1>LIVE GAME CHAT<span>.</span></h1><p>Watch together. Follow live and upcoming games, and join the conversation.</p></div><span aria-hidden="true">◉</span></header>
        <article className="hc-live-hub-card"><strong>Orlando Lions · vs · Miami Waves</strong><p className="muted">National League · Today, 7:30 PM</p><span>Upcoming game chat</span></article>
        <section className="hc-live-hub-filters"><strong>Filter games</strong><p className="muted">All games · Live only · My teams</p></section>
      </section>
      <section className="hc-card-audit-section">
        <h2>ACCOUNT / SETTINGS CARDS</h2>
        <header className="hc-account-settings-header"><p className="hc-account-settings-kicker">ACCOUNT SETTINGS</p><h3>Account preferences</h3></header>
        <Card className="dashboard-card"><p className="eyebrow">ACCOUNT OVERVIEW</p><h3>Jacorie Archie</h3><p className="muted">PLAYER · PREMIUM</p><strong>Profile 85% complete</strong></Card>
        <GroupCard title="Account settings" className="hc-settings-group"><p>Profile and privacy</p><p>Notifications and preferences</p></GroupCard>
      </section>
      <section className="hc-card-audit-section">
        <h2>REVIEW CARDS</h2>
        <ReviewCard username="Overseas Player" date="Nov 6, 2026" rating={4.5} text="Clear expectations, professional communication, and a positive team environment." />
      </section>
      <section className="hc-card-audit-section">
        <h2>MEMBERSHIP CARDS</h2>
        <Surface as="section" className="membership-hero"><p className="eyebrow">MEMBERSHIP</p><h3>Choose your level</h3><p className="muted">Flexible plans for every stage of your basketball journey.</p></Surface>
        <Surface as="article" className="plan-card"><p className="eyebrow">HOOPCHECK MEMBERSHIP</p><h3>Premium</h3><p className="muted">Full access to player tools and live game features.</p><strong>$9.99 / month</strong><ul><li>Full review access</li><li>Live Game Hub</li><li>Player profile tools</li></ul></Surface>
      </section>
      <section className="hc-card-audit-section">
        <h2>GENERIC PANEL / MODAL</h2>
        <Surface as="section" className="hero-card"><h3>Confirm your next move</h3><p className="muted">This is a representative shared hero/panel surface.</p></Surface>
        <Surface as="section" className="modal-panel"><h3>Report submitted</h3><p className="muted">Your report is queued for moderation.</p></Surface>
      </section>
    </section>
  );
}

function HubThemeColumn({ theme }: { theme: "light" | "dark" }) {
  return (
    <section className="hc-card-audit-preview" data-theme-preview={theme} aria-label={theme + " theme live hub preview"}>
      <header className="hc-card-audit-heading"><p className="eyebrow">LIVE GAME HUB · CARD-3 COVERAGE</p><h2>{theme === "dark" ? "Dark theme" : "Light theme"}</h2><p className="muted">Empty states, count badges, filter surface and populated game card.</p></header>
      <section className="hc-card-audit-section"><div className="hc-live-section-heading"><div><p className="eyebrow">RIGHT NOW</p><h2>LIVE NOW <span>0</span></h2></div></div><div className="hc-live-empty"><div className="hc-live-empty__icon"><HoopIcon name="basketball" size={24} /></div><div><h3>No live games right now</h3><p>When a game is live, its chat will appear here.</p></div></div></section>
      <section className="hc-card-audit-section"><div className="hc-live-section-heading"><div><p className="eyebrow">NEXT UP</p><h2>UPCOMING <span>0</span></h2></div></div><div className="hc-live-empty"><div className="hc-live-empty__icon"><HoopIcon name="calendar" size={24} /></div><div><h3>No confirmed upcoming games</h3><p>Confirmed fixtures will appear here when available.</p></div></div></section>
      <section className="hc-card-audit-section"><div className="hc-live-section-heading"><div><p className="eyebrow">FINAL WHISTLE</p><h2>RECENTLY FINISHED <span>0</span></h2></div></div><div className="hc-live-recent-empty">Recent final scores will appear here when available.</div></section>
      <section className="hc-card-audit-section"><div className="hc-live-hub-filters"><strong>Filter games</strong><p className="muted">All games · Live only · My teams</p></div></section>
      <section className="hc-card-audit-section"><article className="hc-live-hub-card"><div className="hc-live-card__top"><strong>Sumqayit BK · vs · Baku Falcons</strong><span className="hc-live-state">UPCOMING</span></div><p className="muted">National League · Sample fixture</p><div className="hc-live-card__actions"><span>Chat opens before tip-off</span></div></article></section>
    </section>
  );
}

export default function ThemeCardAuditPage() {
  return (
    <main className="page-shell hc-card-audit-page">
      <div className="page-container">
        <header className="hc-card-audit-heading"><p className="eyebrow">INTERNAL VISUAL REGRESSION CHECK</p><h1>Card Theme Audit</h1><p className="muted">Review shared card families and live game hub components in both themes.</p></header>
        <div className="hc-card-audit-grid"><ThemeColumn theme="light" /><ThemeColumn theme="dark" /></div>
        <header className="hc-card-audit-heading"><h2>Live game hub cards</h2><p className="muted">Empty-state card, icon chip, zero-count badge, filter card and populated game card.</p></header>
        <div className="hc-card-audit-grid"><HubThemeColumn theme="light" /><HubThemeColumn theme="dark" /></div>
      </div>
    </main>
  );
}
