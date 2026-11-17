"use client";

import { useState } from "react";
import { getHoopCheckEntitlements, type HoopCheckEntitlements, type MembershipTier } from "../../lib/membership-tier";

const roles = {
  player: "Player",
  fan: "Fan",
  coach: "Coach",
  agent: "Agent",
  scout: "Scout",
  manager: "Team Manager",
  ambassador: "Ambassador",
} as const;

const tiers = { free: "Free", pro: "Pro", premium: "Premium" } as const;

const features = {
  canReadHoopFeed: "Read HoopFeed",
  canWriteHoopFeed: "Post on HoopFeed",
  canReadFanFeed: "Read Fan HQ feed",
  canWriteFanFeed: "Post on Fan HQ feed",
  canReadFullReviews: "Read full reviews",
  canViewTrustScore: "View Trust Score",
  canWriteReviews: "Write reviews",
  canUseLiveGameHub: "Live Game Hub",
  canUseLiveGameChat: "Live game chat",
  canCompare: "Compare",
  canUseContractCheck: "Contract Check",
  canUseProPassport: "Pro Passport",
  canUseRecruitingNetwork: "Recruiting Network",
  canUsePayOnTimeIndex: "Pay-on-Time Index",
  canUseAskPlayer: "Ask a Player",
  canConnectWithFans: "Connect with fans",
  canSwitchBasketballSide: "Switch men’s and women’s basketball",
  canStartCoachIdentityVerification: "Start coach identity verification",
  canViewTeamPayHistory: "View team pay history",
  canSubmitPayCheckIn: "Submit a pay check-in",
  canUseFanGroups: "Use fan groups",
} satisfies Partial<Record<keyof HoopCheckEntitlements, string>>;

type Role = keyof typeof roles;
const featureKeys = Object.keys(features) as (keyof typeof features)[];

export default function OwnerRolePreview() {
  const [role, setRole] = useState<Role>("player");
  const [tier, setTier] = useState<MembershipTier>("free");
  const [verifiedPlayer, setVerifiedPlayer] = useState(false);
  const entitlements = getHoopCheckEntitlements({
    accountType: role,
    subscription: tier === "free" ? null : { plan: tier, status: "active" },
    playerVerified: role === "player" && verifiedPlayer,
  });

  return (
    <section className="dashboard-card" aria-labelledby="owner-preview-heading">
      <h2 id="owner-preview-heading">Preview account access</h2>
      <p>Check what a role and membership can access. Your own account and membership stay the same.</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBlock: 12 }}>
        <label>
          Account type
          <select className="input" value={role} onChange={event => setRole(event.target.value as Role)}>
            {Object.entries(roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {role !== "ambassador" && (
          <label>
            Membership tier
            <select className="input" value={tier} onChange={event => setTier(event.target.value as MembershipTier)}>
              {Object.entries(tiers).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        )}
        {role === "player" && (
          <label>
            <input type="checkbox" checked={verifiedPlayer} onChange={event => setVerifiedPlayer(event.target.checked)} />
            {" "}Verified player
          </label>
        )}
      </div>

      <h3 aria-live="polite">{roles[role]}{role === "ambassador" ? "" : ` · ${tiers[entitlements.tier]}`}</h3>
      {role === "ambassador" ? (
        <p>Ambassador HQ access depends on campaign assignment. Assigned ambassadors can view their referral link, conversions, and commission history.</p>
      ) : (
        <ul style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))", gap: 8 }}>
          {featureKeys.map(feature => (
            <li key={feature}>{features[feature]} · <strong>{entitlements[feature] ? "Available" : "Locked"}</strong></li>
          ))}
        </ul>
      )}
      {role === "manager" && <p>Club management and group moderation require an approved claim for the club.</p>}
    </section>
  );
}
