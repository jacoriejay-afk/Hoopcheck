import { readFileSync } from "node:fs";

const css = readFileSync("app/hoopcheck-hub-empty-state-pairing.css", "utf8");
const layout = readFileSync("app/layout.tsx", "utf8");
const auditPage = readFileSync("app/theme-card-audit/page.tsx", "utf8");
const browserCheck = readFileSync("scripts/theme-browser-check.mjs", "utf8");
const fanFeedPage = readFileSync("app/fan-feed/page.tsx", "utf8");
const fanFeedI18n = readFileSync("app/fan-feed/i18n.ts", "utf8");
const themeAudit = readFileSync("app/hoopcheck-theme-audit.css", "utf8");
const failures = [];

const requiredCss = [
  ".hc-live-hub-page .hc-live-empty",
  ".hc-live-hub-page .hc-live-empty__icon",
  ".hc-live-hub-page .hc-live-section-heading h2 span",
  ".hc-live-hub-page .hc-live-hub-card,",
  ".hc-live-hub-page .hc-live-recent-empty",
  ".hc-live-hub-page .hc-live-card__crest",
  ".hc-live-hub-page .hc-live-join",
  "background: var(--hc-surface-raised) !important",
  "color: var(--hc-foreground) !important",
  "background: var(--hc-surface-soft) !important",
  "color: var(--hc-orange) !important",
  '.hc-card-audit-preview[data-theme-preview="light"]',
  '.hc-card-audit-preview[data-theme-preview="dark"]',
];
for (const required of requiredCss) {
  if (!css.includes(required)) failures.push("Missing hub theme CSS contract: " + required);
}
for (const selector of [":not(.hc-live-empty *)", ":not(.hc-live-section-heading *)", ":not(.hc-live-hub-card *)", ":not(.hc-live-recent-empty *)"]) {
  if (!themeAudit.includes(selector)) failures.push("Global theme ink pass is not excluding paired live hub surface: " + selector);
}
if (!css.includes(".hc-live-hub-page .hc-live-section-heading .eyebrow")) {
  failures.push("Live hub section eyebrow is missing its muted foreground token.");
}

const requiredAuditPage = [
  'data-theme-preview={theme}',
  'theme="light"',
  'theme="dark"',
  'className="hc-live-empty"',
  'className="hc-live-empty__icon"',
  'className="hc-live-hub-filters"',
  'className="hc-live-hub-card"',
  'RECENTLY FINISHED',
];
for (const required of requiredAuditPage) {
  if (!auditPage.includes(required)) failures.push("Theme audit page missing HUB-1 specimen: " + required);
}

const requiredBrowserCoverage = [
  '"/live-games"',
  '"/theme-card-audit"',
  '".hc-live-empty"',
  '".hc-live-empty__icon"',
  '".hc-live-section-heading h2 span"',
  '".hc-live-hub-filters"',
  '".hc-live-hub-card"',
  '".hc-live-hub-hero"',
  '".hc-live-recent-empty"',
  '".hc-live-card__crest"',
  '".hc-live-join"',
  '".hc-live-card__meta"',
  'THEME_COMPONENT_INVENTORY',
];
for (const required of requiredBrowserCoverage) {
  if (!browserCheck.includes(required)) failures.push("Browser regression inventory missing: " + required);
}

const scaffoldTerms = ["KICKER", "TITLE", "Subtitle", "TEAM FIRST", "Fan Only Note", "Composer Placeholder", "EMPTY TITLE", "EMPTY KICKER", "Empty Body", "Lorem", "TODO", "Placeholder"];
for (const term of scaffoldTerms) {
  if (!browserCheck.includes(term)) failures.push("Rendered scaffold guard is missing term: " + term);
}
for (const route of ['"/fan-feed"', '"/team-hub/groups/"', '"/live-games"', '"/theme-card-audit"']) {
  if (!browserCheck.includes(route)) failures.push("Browser route coverage missing: " + route);
}
if (!fanFeedPage.includes("<h1>Fan HQ</h1>") ||
    !fanFeedPage.includes("Fan posts about the clubs you follow.") ||
    !fanFeedPage.includes("selectedTeam.name} fans") ||
    !fanFeedPage.includes("fanFeedTeamComposerPlaceholder") ||
    !fanFeedI18n.includes('composer: "Post to {team} fans…"')) {
  failures.push("Fan HQ must have a stable mixed-feed title and a club-specific composer.");
}

const importLine = 'import "./hoopcheck-hub-empty-state-pairing.css";';
if (!layout.includes(importLine)) failures.push("Hub pairing CSS is not imported by the root layout.");
if (layout.indexOf(importLine) < layout.indexOf('import "./hoopcheck-desk-3.css";')) {
  failures.push("Hub pairing CSS must load after legacy page styles.");
}

if (failures.length) {
  console.error("HUB_THEME_PAIRING_CHECK=FAIL");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}
console.log("HUB_THEME_PAIRING_CHECK=PASS");
