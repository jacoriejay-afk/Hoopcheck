"use client";

import Link from "next/link";

export type PlayerContractRecord = {
  id: string;
  team: string;
  league: string;
  country: string;
  season: string;
  status: "Active" | "Completed" | "Disputed";
  games: number | null;
  salary: string | null;
  currency: string | null;
  paymentStatus: string | null;
  verified: boolean;
};

export type VerifiedAgentReview = {
  id: string;
  agent: string;
  organization: string | null;
  rating: number;
  date: string;
  summary: string;
  verified: boolean;
};

type PlayerProfilePanelProps = {
  playerName: string;
  username?: string | null;
  position?: string | null;
  nationality?: string | null;
  currentTeam?: string | null;
  currentCountry?: string | null;
  seasonsPro?: number | null;
  verifiedPlayer: boolean;
  bio?: string | null;
  contracts?: PlayerContractRecord[];
  reviews?: VerifiedAgentReview[];
};

const statusClass: Record<PlayerContractRecord["status"], string> = {
  Active: "hc-contract-status hc-contract-status-active",
  Completed: "hc-contract-status hc-contract-status-completed",
  Disputed: "hc-contract-status hc-contract-status-disputed",
};

function PanelHeading({ label, title, count }: { label: string; title: string; count: number }) {
  return (
    <div className="hc-profile-panel-heading">
      <div>
        <p className="hc-profile-eyebrow">{label}</p>
        <h2>{title}</h2>
      </div>
      <span className="hc-profile-record-count">{String(count).padStart(2, "0")} RECORDS</span>
    </div>
  );
}

export default function PlayerProfilePanel({
  playerName,
  username,
  position,
  nationality,
  currentTeam,
  currentCountry,
  seasonsPro,
  verifiedPlayer,
  bio,
  contracts = [],
  reviews = [],
}: PlayerProfilePanelProps) {
  const verifiedReviews = reviews.filter((review) => review.verified);
  const averageRating = verifiedReviews.length
    ? (verifiedReviews.reduce((sum, review) => sum + review.rating, 0) / verifiedReviews.length).toFixed(1)
    : null;

  const stats = [
    { label: "Active Contracts", value: contracts.filter((item) => item.status === "Active").length },
    { label: "Completed", value: contracts.filter((item) => item.status === "Completed").length },
    { label: "Disputed", value: contracts.filter((item) => item.status === "Disputed").length },
    { label: "Games Logged", value: contracts.reduce((sum, item) => sum + (item.games ?? 0), 0) },
  ];

  return (
    <div className="hc-player-dossier">
      <section className="hc-dossier-identity rounded-xl" aria-label="Player overview">
        <div className="hc-dossier-identity-main">
          <p className="hc-profile-eyebrow">PLAYER DOSSIER</p>
          <h2 className="hc-dossier-name">{playerName}</h2>
          {username && <p className="hc-dossier-username">@{username}</p>}
          <div className="hc-dossier-tags">
            {verifiedPlayer && <span className="hc-dossier-tag hc-dossier-tag-orange">✓ VERIFIED PLAYER</span>}
            {position && <span className="hc-dossier-tag">{position}</span>}
            {nationality && <span className="hc-dossier-tag">{nationality}</span>}
            {seasonsPro != null && <span className="hc-dossier-tag">{seasonsPro} PRO SEASONS</span>}
          </div>
          <div className="hc-dossier-team-grid">
            <div><span>Current Team</span><strong>{currentTeam || "Not listed"}</strong></div>
            <div><span>Current Country</span><strong>{currentCountry || "Not listed"}</strong></div>
          </div>
        </div>
        <div className="hc-dossier-overview-stats">
          <div><span>CONTRACT RECORDS</span><strong>{contracts.length.toString().padStart(2, "0")}</strong></div>
          <div><span>VERIFIED AGENT REVIEWS</span><strong>{verifiedReviews.length.toString().padStart(2, "0")}</strong><small>{averageRating ? `${averageRating} / 5 average` : "No verified ratings yet"}</small></div>
        </div>
        <div className="hc-dossier-accent" aria-hidden="true" />
      </section>

      {bio && (
        <section className="hc-profile-panel rounded-xl">
          <div className="hc-profile-panel-heading"><div><p className="hc-profile-eyebrow">PLAYER BACKGROUND</p><h2>About {playerName}</h2></div></div>
          <p className="hc-profile-bio">{bio}</p>
        </section>
      )}

      <section id="contract-statistics" className="hc-profile-panel rounded-xl">
        <PanelHeading label="CAREER RECORD / 01" title="Contract Statistics" count={contracts.length} />
        <div className="hc-profile-stat-grid">
          {stats.map((stat) => <div className="hc-profile-stat-cell" key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong></div>)}
        </div>
        {contracts.length === 0 ? (
          <div className="hc-profile-empty">
            <strong>No contract records available</strong>
            <p>Contract statistics will appear when records have been submitted and verified for this player.</p>
          </div>
        ) : (
          <>
            <div className="hc-contract-mobile-list">
              {contracts.map((contract) => (
                <article key={contract.id} className="hc-contract-mobile-row">
                  <div className="hc-contract-mobile-top"><div><strong>{contract.team}</strong><span>{contract.league} · {contract.country}</span></div><span className={statusClass[contract.status]}>{contract.status}</span></div>
                  <dl>
                    <div><dt>Season</dt><dd>{contract.season}</dd></div>
                    <div><dt>Games</dt><dd>{contract.games ?? "—"}</dd></div>
                    <div><dt>Reported Salary</dt><dd>{contract.salary ? `${contract.salary} ${contract.currency || ""}`.trim() : "Not disclosed"}</dd></div>
                    <div><dt>Payment Record</dt><dd>{contract.paymentStatus || "Not recorded"}</dd></div>
                  </dl>
                  <p className="hc-contract-verification">{contract.verified ? "✓ Record verified" : "Unverified record"}</p>
                </article>
              ))}
            </div>
            <div className="hc-contract-table-wrap">
              <table className="hc-contract-table">
                <thead><tr><th>Team / League</th><th>Season</th><th>Status</th><th>Games</th><th>Reported Salary</th><th>Payment Record</th><th>Verification</th></tr></thead>
                <tbody>{contracts.map((contract) => (
                  <tr key={contract.id}>
                    <td><strong>{contract.team}</strong><small>{contract.league} · {contract.country}</small></td>
                    <td>{contract.season}</td>
                    <td><span className={statusClass[contract.status]}>{contract.status}</span></td>
                    <td className="hc-number-cell">{contract.games ?? "—"}</td>
                    <td>{contract.salary ? `${contract.salary} ${contract.currency || ""}`.trim() : "Not disclosed"}</td>
                    <td>{contract.paymentStatus || "Not recorded"}</td>
                    <td>{contract.verified ? <span className="hc-verified-text">✓ Verified</span> : <span className="hc-muted-text">Unverified</span>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </>
        )}
        <p className="hc-profile-disclaimer">Salary, payment, and contract details are not independently verified unless the individual record is explicitly marked as verified.</p>
      </section>

      <section id="verified-agent-reviews" className="hc-profile-panel rounded-xl">
        <PanelHeading label="AGENT FEEDBACK / 02" title="Verified Agent Reviews" count={verifiedReviews.length} />
        {verifiedReviews.length === 0 ? (
          <div className="hc-profile-empty">
            <strong>No verified agent reviews yet</strong>
            <p>Reviews will appear here after identity, relationship, and moderation checks are completed.</p>
          </div>
        ) : (
          <div className="hc-agent-review-list">
            {verifiedReviews.map((review) => (
              <article className="hc-agent-review-row" key={review.id}>
                <div className="hc-agent-review-copy">
                  <div className="hc-agent-review-title"><h3>{review.agent}</h3><span className="hc-agent-verified">✓ VERIFIED</span></div>
                  <p className="hc-agent-review-meta">{review.organization ? `${review.organization} · ` : ""}{review.date}</p>
                  <p className="hc-agent-review-summary">{review.summary}</p>
                </div>
                <div className="hc-agent-rating"><span>RATING</span><strong>{review.rating.toFixed(1)}<small>/5</small></strong></div>
              </article>
            ))}
          </div>
        )}
        <div className="hc-profile-panel-footer">
          <p>Only reviews that pass HoopCheck’s verification and moderation checks belong in this section.</p>
          <Link href="/support" className="hc-profile-outline-link">Review Verification Policy ↗</Link>
        </div>
      </section>
    </div>
  );
}
