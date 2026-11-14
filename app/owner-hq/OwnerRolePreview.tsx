"use client";

import { useState } from "react";

type Role = "player" | "fan" | "agent" | "team" | "ambassador";
type Tier = "free" | "pro" | "premium";

const roleLabels: Record<Role, string> = {
  player: "Player", fan: "Fan", agent: "Agent / Scout",
  team: "Team Manager", ambassador: "Ambassador",
};
const tierLabels: Record<Tier, string> = { free: "Free", pro: "Pro", premium: "Premium" };
const preview: Record<Role, string[]> = {
  player: ["Player profile and directory", "Club reviews and Pre-Sign Check", "HoopFeed and connections"],
  fan: ["Team follows and fan groups", "Live Game Hub and chat", "Fan membership content"],
  agent: ["Player and club discovery", "Scouting tools and connections", "Agents HQ"],
  team: ["Claimed club management", "Roster and team profile", "Fan community moderation"],
  ambassador: ["Referral link and conversions", "Commission history", "Payout reports"],
};

export default function OwnerRolePreview() {
  const [role, setRole] = useState<Role>("player");
  const [tier, setTier] = useState<Tier>("free");
  const membership = role === "player" || role === "fan";
  return <section className="dashboard-card" aria-label="Owner role preview">
    <h2>Preview account experience</h2>
    <p role="status"><strong>READ-ONLY PREVIEW</strong> — This is a feature checklist, not an impersonated account or a live entitlement test.</p>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBlock:12}} role="group" aria-label="Account type">
      {(Object.keys(roleLabels) as Role[]).map(item =>
        <button type="button" key={item} className={role===item?"btn":"btn dark"} aria-pressed={role===item} onClick={()=>setRole(item)}>{roleLabels[item]}</button>
      )}
    </div>
    {membership && <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBlock:12}} role="group" aria-label="Membership tier">
      {(Object.keys(tierLabels) as Tier[]).map(item =>
        <button type="button" key={item} className={tier===item?"btn":"btn dark"} aria-pressed={tier===item} onClick={()=>setTier(item)}>{tierLabels[item]}</button>
      )}
    </div>}
    <h3>{roleLabels[role]}{membership ? ` · ${tierLabels[tier]}` : ""}</h3>
    <ul>{preview[role].map(item=><li key={item}>{item}</li>)}</ul>
    <p>Access restrictions must be verified using the real entitlement resolver and isolated test fixtures before this preview can be treated as a permission audit.</p>
  </section>;
}
