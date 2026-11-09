import { readFile } from "node:fs/promises";

const files = {
  tokens: await readFile("app/hoopcheck-theme-tokens.css", "utf8"),
  home: await readFile("app/hoopcheck-ia1-home.css", "utf8"),
  live: await readFile("app/globals.css", "utf8"),
  nav: await readFile("app/hoopcheck-lm2f-bottom-nav.css", "utf8"),
  finalTheme: await readFile("app/hoopcheck-theme-tokens.css", "utf8"),
  finalOverrides: await readFile("app/hoopcheck-final-overrides.css", "utf8"),
  layout: await readFile("app/layout.tsx", "utf8"),
  team: await readFile("app/hoopcheck-directory-profile.css", "utf8"),
  polish: await readFile("app/hoopcheck-polish.css", "utf8"),
};
const errors = [];
const requiredTokens = [
  "--hc-card","--hc-border","--hc-foreground","--hc-foreground-muted",
  "--hc-card-surface","--hc-card-border","--hc-on-card","--hc-on-card-muted",
  "--hc-chip-surface","--hc-chip-foreground","--hc-live-chip-surface",
  "--hc-live-chip-foreground","--hc-button-primary-surface","--hc-button-primary-foreground","--hc-button-primary-bg","--hc-button-primary-fg",
  "--hc-button-outline-bg","--hc-button-outline-fg","--hc-brand-tile-bg","--hc-brand-tile-fg","--hc-brand-tile-border",
  "--hc-button-outline-surface","--hc-button-outline-foreground","--hc-empty-surface","--hc-empty-foreground",
  "--hc-tab-bg","--hc-tab-fg","--hc-nav-active-bg","--hc-nav-active-fg",
  "--hc-accent-text","--hc-hero-surface","--hc-on-hero","--hc-hero-muted","--hc-hero-border",
];
function blockAfter(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp("(?:^|})\\s*[^{}]*" + escaped + "(?![a-zA-Z0-9_-])[^{}]*\\{([^}]*)\\}", "m"));
  return match?.[1] ?? null;
}
function tokenValue(themeSelector, token, seen = new Set()) {
  if (seen.has(token)) return null;
  seen.add(token);
  const block = blockAfter(files.tokens, themeSelector);
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const value = block?.match(new RegExp(escaped + "\\s*:\\s*([^;]+)"))?.[1]?.trim();
  if (!value) return null;
  const alias = value.match(/^var\((--[a-z0-9-]+)\)$/i);
  if (alias) return tokenValue(themeSelector, alias[1], seen);
  const rgb = value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgb) return "#" + rgb.slice(1).map(n => Number(n).toString(16).padStart(2, "0")).join("");
  return /^#[0-9a-f]{6}$/i.test(value) ? value : null;
}
function luminance(hex) {
  const rgb=hex.slice(1).match(/.{2}/g).map(v=>parseInt(v,16)/255)
    .map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
}
function contrast(fg,bg) {
  const [a,b]=[luminance(fg),luminance(bg)].sort((x,y)=>y-x);
  return (a+.05)/(b+.05);
}
for (const theme of ["html.theme-light","html.theme-dark"]) {
  for (const token of requiredTokens) if (!tokenValue(theme,token)) errors.push(`${theme} missing ${token}`);
  for (const [alias,canonical] of [["--hc-card","--hc-card-surface"],["--hc-border","--hc-card-border"],["--hc-foreground","--hc-on-card"],["--hc-foreground-muted","--hc-on-card-muted"],["--hc-button-primary-bg","--hc-button-primary-surface"],["--hc-button-primary-fg","--hc-button-primary-foreground"],["--hc-button-outline-bg","--hc-button-outline-surface"],["--hc-button-outline-fg","--hc-button-outline-foreground"],["--hc-hero-surface","--hc-card-surface"],["--hc-on-hero","--hc-on-card"],["--hc-hero-muted","--hc-on-card-muted"],["--hc-hero-border","--hc-card-border"]]) {
    if (tokenValue(theme,alias) !== tokenValue(theme,canonical)) errors.push(`${theme} legacy alias ${alias} must equal ${canonical}`);
  }
}
const contrastPairs=[
  ["html.theme-light","--hc-on-card","--hc-card-surface"],
  ["html.theme-dark","--hc-on-card","--hc-card-surface"],
  ["html.theme-light","--hc-foreground","--hc-card"],
  ["html.theme-dark","--hc-foreground","--hc-card"],
  ["html.theme-light","--hc-chip-foreground","--hc-chip-surface"],
  ["html.theme-dark","--hc-chip-foreground","--hc-chip-surface"],
  ["html.theme-light","--hc-live-chip-foreground","--hc-live-chip-surface"],
  ["html.theme-dark","--hc-live-chip-foreground","--hc-live-chip-surface"],
  ["html.theme-light","--hc-empty-foreground","--hc-empty-surface"],
  ["html.theme-dark","--hc-empty-foreground","--hc-empty-surface"],
  ["html.theme-light","--hc-button-primary-foreground","--hc-button-primary-surface"],
  ["html.theme-dark","--hc-button-primary-foreground","--hc-button-primary-surface"],
  ["html.theme-light","--hc-tab-fg","--hc-tab-bg"],
  ["html.theme-dark","--hc-tab-fg","--hc-tab-bg"],
  ["html.theme-light","--hc-nav-active-fg","--hc-nav-active-bg"],
  ["html.theme-dark","--hc-nav-active-fg","--hc-nav-active-bg"],
  ["html.theme-light","--hc-button-primary-fg","--hc-button-primary-bg"],
  ["html.theme-dark","--hc-button-primary-fg","--hc-button-primary-bg"],
  ["html.theme-light","--hc-button-outline-fg","--hc-button-outline-bg"],
  ["html.theme-dark","--hc-button-outline-fg","--hc-button-outline-bg"],
  ["html.theme-light","--hc-brand-tile-fg","--hc-brand-tile-bg"],
  ["html.theme-dark","--hc-brand-tile-fg","--hc-brand-tile-bg"],
  ["html.theme-light","--hc-accent-text","--hc-card-surface"],
  ["html.theme-dark","--hc-accent-text","--hc-card-surface"],
  ["html.theme-light","--hc-on-hero","--hc-hero-surface"],
  ["html.theme-dark","--hc-on-hero","--hc-hero-surface"],
  ["html.theme-light","--hc-hero-muted","--hc-hero-surface"],
  ["html.theme-dark","--hc-hero-muted","--hc-hero-surface"],
];
for (const [theme,fgToken,bgToken] of contrastPairs) {
  const fg=tokenValue(theme,fgToken),bg=tokenValue(theme,bgToken);
  if(!fg||!bg)continue;
  const ratio=contrast(fg,bg);
  if(ratio<4.5)errors.push(`${theme} ${fgToken} on ${bgToken} contrast ${ratio.toFixed(2)}:1 below 4.5:1`);
  else console.log(`PASS ${theme} ${fgToken} on ${bgToken}: ${ratio.toFixed(2)}:1`);
}
const authoredPairs=[
  ["Home identity chip",".hc-ia-identity","home",["--hc-card-surface","--hc-on-card","--hc-card-border"]],
  ["Home completion card",".hc-ia-completion","home",["--hc-card-surface","--hc-on-card","--hc-card-border"]],
  ["Home Live Games card",".hc-ia-live-strip","home",["--hc-card-surface","--hc-on-card","--hc-card-border"]],
  ["Home Quick Access rows",".hc-ia-door","home",["--hc-card-surface","--hc-on-card","--hc-card-border"]],
  ["Home follow list",".hc-ia-follow-list","home",["--hc-card-surface","--hc-on-card","--hc-card-border"]],
  ["Home feed card",".hc-ia-feed-card","home",["--hc-card-surface","--hc-on-card","--hc-card-border"]],
  ["Live game card",".hc-live-hub-card","live",["--hc-card-surface","--hc-on-card","--hc-card-border"]],
  ["Live upcoming/status pill",".hc-live-state","live",["--hc-chip-surface","--hc-chip-foreground","--hc-card-border"]],
  ["Live reminder button",".hc-remind-button","live",["--hc-button-outline-surface","--hc-button-outline-foreground","--hc-card-border"]],
  ["Live empty state",".hc-live-empty","live",["--hc-empty-surface","--hc-empty-foreground","--hc-card-border"]],
  ["Live no-games state",".hc-live-no-games","live",["--hc-empty-surface","--hc-empty-foreground","--hc-card-border"]],
  ["Team profile header light",".hc-team-entity-profile .hc-team-profile-hero","team",["--hc-card","--hc-foreground","--hc-border"]],
  ["Team profile header","html.theme-dark .hc-team-entity-profile .hc-team-profile-hero","team",["--hc-card","--hc-foreground","--hc-border"]],
  ["Team follow button",".hc-team-profile-topline .hc-team-follow-pill.is-not-following","team",["--hc-button-primary-bg","--hc-button-primary-fg"]],
  ["Team following button",".hc-team-profile-topline .hc-team-follow-pill.is-following","team",["--hc-button-outline-bg","--hc-button-outline-fg","--hc-border"]],
  ["Team logo fallback",".hc-team-profile-topline .hc-team-logo--fallback","team",["--hc-brand-tile-bg","--hc-brand-tile-border"]],
  ["Search submit button",".hc-searchbar__submit","live",["--hc-button-primary-surface","--hc-button-primary-foreground"]],
  ["Live Games hero",".hc-live-hub-hero","live",["--hc-hero-surface","--hc-on-hero","--hc-hero-border"]],
  ["Team profile active tab",'.hc-team-entity-profile .hc-team-profile-nav a[aria-current="page"]',"team",["--hc-accent-text"]],
  ["Team profile kicker",".hc-team-profile-kicker","team",["--hc-accent-text"]],
  ["Text action button",".hc-text-button","live",["--hc-accent-text"]],
];
for(const [label,selector,file,tokens] of authoredPairs){
  const rule=blockAfter(files[file],selector);
  if(!rule){errors.push(`${label}: selector missing in ${file}`);continue;}
  for(const token of tokens)if(!rule.includes(`var(${token}`))errors.push(`${label}: missing ${token} in authored rule`);
  if(/\b(?:background(?:-color)?|color|border-color)\s*:\s*(?:#[0-9a-f]{3,8}\b|rgba?\(|white\b|black\b)/i.test(rule))
    errors.push(`${label}: hard-coded surface/foreground color found in component rule`);
}
const pageShellRule=blockAfter(files.finalOverrides,".page-shell");
if(!pageShellRule || !pageShellRule.includes("var(--hc-card-surface)") || !pageShellRule.includes("var(--hc-card-border)") || !pageShellRule.includes("var(--hc-on-card)") || !pageShellRule.includes("var(--hc-on-card-muted)"))
  errors.push("PageShell: local surface and border must inherit the active card token pair");
if(pageShellRule && /--hc-(?:surface|border)\\s*:\\s*#[0-9a-f]{3,8}/i.test(pageShellRule))
  errors.push("PageShell: fixed light/dark surface or border value is forbidden");

const navRule=blockAfter(files.nav,"html.theme-light body nav.hc-lm2f-bottom-nav");
if(!navRule || !navRule.includes("var(--hc-tab-bg") || !navRule.includes("var(--hc-card-border"))
  errors.push("Bottom tab bar: surface and border must use nav/card tokens");
const navTextRule=blockAfter(files.nav,"html.theme-dark body nav.hc-lm2f-bottom-nav > a.hc-lm2f-tab");
if(!navTextRule || !navTextRule.includes("var(--hc-tab-fg"))
  errors.push("Bottom tab bar: label foreground must use --hc-tab-fg");
const navActiveRule=blockAfter(files.nav,"html body nav.hc-lm2f-bottom-nav > a.hc-lm2f-tab.active");
if(!navActiveRule || !navActiveRule.includes("var(--hc-nav-active-fg"))
  errors.push("Bottom tab bar: active label must use --hc-nav-active-fg");
if (!files.layout.includes('import "./hoopcheck-theme-tokens.css";') ||
    !files.layout.includes('import "./hoopcheck-card-pairing.css";'))
  errors.push("Canonical tokens and the card pairing contract must both be loaded");

if(errors.length){
  console.error("THEME_PAIR_AUDIT=FAIL");
  for(const error of errors)console.error("- "+error);
  process.exitCode=1;
}else{
  console.log("THEME_PAIR_AUDIT=PASS");
  console.log(`Verified ${requiredTokens.length} theme tokens in both themes and ${authoredPairs.length} authored component pairs.`);
}
