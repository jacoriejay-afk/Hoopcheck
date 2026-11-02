import { readFile } from "node:fs/promises";

const files = {
  tokens: await readFile("app/hoopcheck-theme-tokens.css", "utf8"),
  home: await readFile("app/hoopcheck-ia1-home.css", "utf8"),
  live: await readFile("app/globals.css", "utf8"),
};

const errors = [];
const requiredTokens = [
  "--hc-card-surface", "--hc-card-border", "--hc-on-card", "--hc-on-card-muted",
  "--hc-chip-surface", "--hc-chip-foreground", "--hc-live-chip-surface",
  "--hc-live-chip-foreground", "--hc-button-outline-surface",
  "--hc-button-outline-foreground", "--hc-empty-surface", "--hc-empty-foreground",
];

function blockAfter(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp("(?:^|})\\s*" + escaped + "\\s*\\{([^}]*)\\}", "m"));
  return match?.[1] ?? null;
}
function tokenValue(themeSelector, token) {
  const block = blockAfter(files.tokens, themeSelector);
  if (!block) return null;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return block.match(new RegExp(escaped + "\\s*:\\s*(#[0-9a-fA-F]{6})"))?.[1] ?? null;
}
function luminance(hex) {
  const rgb = hex.slice(1).match(/.{2}/g).map(v => parseInt(v, 16) / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
}
function contrast(fg,bg) {
  const [a,b]=[luminance(fg),luminance(bg)].sort((x,y)=>y-x);
  return (a+.05)/(b+.05);
}
for (const theme of ["html.theme-light","html.theme-dark"]) {
  for (const token of requiredTokens) {
    if (!tokenValue(theme,token)) errors.push(`${theme} is missing ${token}`);
  }
}
const contrastPairs = [
  ["html.theme-light","--hc-on-card","--hc-card-surface"],
  ["html.theme-dark","--hc-on-card","--hc-card-surface"],
  ["html.theme-light","--hc-chip-foreground","--hc-chip-surface"],
  ["html.theme-dark","--hc-chip-foreground","--hc-chip-surface"],
  ["html.theme-light","--hc-live-chip-foreground","--hc-live-chip-surface"],
  ["html.theme-dark","--hc-live-chip-foreground","--hc-live-chip-surface"],
  ["html.theme-light","--hc-empty-foreground","--hc-empty-surface"],
  ["html.theme-dark","--hc-empty-foreground","--hc-empty-surface"],
];
for (const [theme,fgToken,bgToken] of contrastPairs) {
  const fg=tokenValue(theme,fgToken), bg=tokenValue(theme,bgToken);
  if (!fg || !bg) continue;
  const ratio=contrast(fg,bg);
  if (ratio<4.5) errors.push(`${theme} ${fgToken}/${bgToken} contrast ${ratio.toFixed(2)}:1 is below 4.5:1`);
  else console.log(`PASS ${theme} ${fgToken} on ${bgToken}: ${ratio.toFixed(2)}:1`);
}

// Every registered component surface must consume the semantic token pair.
// These source rules are deliberately checked where they are authored, not
// merely against a later override that could hide a hard-coded regression.
const authoredPairs = [
  ["Home identity chip",".hc-ia-identity","home",["--hc-card-surface","--hc-on-card","--hc-card-border"]],
  ["Home completion card",".hc-ia-completion","home",["--hc-card-surface","--hc-on-card","--hc-card-border"]],
  ["Home Live Games card",".hc-ia-completion,.hc-ia-live-strip","home",["--hc-card-surface","--hc-on-card","--hc-card-border"]],
  ["Home Quick Access rows",".hc-ia-door","home",["--hc-card-surface","--hc-on-card","--hc-card-border"]],
  ["Home follow list",".hc-ia-follow-list","home",["--hc-card-surface","--hc-on-card","--hc-card-border"]],
  ["Home feed card",".hc-ia-feed-card","home",["--hc-card-surface","--hc-on-card","--hc-card-border"]],
  ["Live game card",".hc-live-hub-card","live",["--hc-card-surface","--hc-on-card","--hc-card-border"]],
  ["Live upcoming/status pill",".hc-live-badge,.hc-live-state","live",["--hc-chip-surface","--hc-chip-foreground","--hc-card-border"]],
  ["Live reminder button",".hc-remind-button","live",["--hc-button-outline-surface","--hc-button-outline-foreground","--hc-card-border"]],
  ["Live empty state",".hc-live-empty","live",["--hc-empty-surface","--hc-empty-foreground","--hc-card-border"]],
  ["Live no-games state",".hc-live-no-games","live",["--hc-empty-surface","--hc-empty-foreground","--hc-card-border"]],
];
for (const [label,selector,file,tokens] of authoredPairs) {
  const source=files[file];
  const rule=blockAfter(source,selector);
  if (!rule) { errors.push(`${label}: selector rule missing in ${file}`); continue; }
  for (const token of tokens) if (!rule.includes(`var(${token}`)) errors.push(`${label}: missing ${token} in authored rule`);
  if (/\b(?:background(?:-color)?|color|border-color)\s*:\s*(?:#[0-9a-f]{3,8}\b|rgba?\(|white\b|black\b)/i.test(rule)) {
    errors.push(`${label}: literal surface/foreground color found in authored rule`);
  }
}
if (errors.length) {
  console.error("THEME_PAIR_AUDIT=FAIL");
  for (const error of errors) console.error("- "+error);
  process.exitCode=1;
} else {
  console.log("THEME_PAIR_AUDIT=PASS");
  console.log(`Verified ${requiredTokens.length} paired tokens in both themes and ${authoredPairs.length} authored component surface pairs.`);
}
