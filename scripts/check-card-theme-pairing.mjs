import { readFileSync } from "node:fs";

const tokens = readFileSync("app/hoopcheck-theme-tokens.css", "utf8");
const contract = readFileSync("app/hoopcheck-card-pairing.css", "utf8");
const layout = readFileSync("app/layout.tsx", "utf8");
const auditPage = readFileSync("app/theme-card-audit/page.tsx", "utf8");

const requiredPairs = [
  "--hc-on-surface:",
  "--hc-on-surface-muted:",
  "--hc-on-surface-raised:",
  "--hc-on-surface-raised-muted:",
  "--hc-card: var(--hc-surface-raised)",
];
const requiredCards = [
  [".hc-category-tile", "CategoryTile"],
  [".hc-live-hub-hero", "hc-live-hub-hero"],
  [".hc-team-profile-hero", "hc-team-profile-hero"],
  [".hc-player-profile-hero", "hc-player-profile-hero"],
  [".hc-live-hub-card", "hc-live-hub-card"],
  [".hc-live-hub-filters", "hc-live-hub-filters"],
  [".hc-dossier-identity", "PlayerProfilePanel"],
  [".hc-account-page .dashboard-card", "dashboard-card"],
  [".hc-review-card", "ReviewCard"],
  [".hc-membership-page .plan-card", "plan-card"],
  [".membership-hero", "membership-hero"],
  [".hc-account-settings-header", "hc-account-settings-header"],
  [".hc-layout-card", "Card"],
  [".hc-layout-group", "GroupCard"],
];
const failures = [];

for (const token of requiredPairs) {
  if (!tokens.includes(token) && !contract.includes(token)) failures.push(`Missing semantic token: ${token}`);
}
for (const [selector, specimen] of requiredCards) {
  if (!contract.includes(selector)) failures.push(`Card pairing contract missing: ${selector}`);
  if (!auditPage.includes(specimen)) failures.push(`Visual audit page missing specimen for: ${selector}`);
}
if (!layout.includes('import "./hoopcheck-card-pairing.css";')) failures.push("Card pairing CSS is not loaded by the root layout.");
if (!layout.includes('import "./hoopcheck-card-pairing.css";') ||
    layout.indexOf('import "./hoopcheck-card-pairing.css";') < layout.indexOf('import "./hoopcheck-desk-3.css";')) {
  failures.push("Card pairing CSS must load after legacy page styles.");
}
if (!auditPage.includes('data-theme-preview={theme}') ||
    !auditPage.includes('theme="light"') ||
    !auditPage.includes('theme="dark"')) {
  failures.push("Visual audit page must render both light and dark preview columns.");
}

if (failures.length) {
  console.error("CARD-1 pairing check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("CARD-1 pairing contract and light/dark visual audit specimens are present.");
