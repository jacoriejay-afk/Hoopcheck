import { readFile } from "node:fs/promises";

const cssPath = "app/hoopcheck-layout-system.css";
const css = await readFile(cssPath, "utf8");
const contract = css.split("/* DM-1 — paired semantic tokens")[1] ?? "";

// Register every new semantic state, badge, or button family here. The audit
// fails if its selector loses either half of the foreground/background pair.
const requiredPairs = [
  [".hc-live-no-games", "--hc-empty-bg", "--hc-empty-fg"],
  [".hc-live-empty", "--hc-empty-bg", "--hc-empty-fg"],
  [".hc-live-recent-empty", "--hc-empty-bg", "--hc-empty-fg"],
  [".hc-live-empty-state", "--hc-empty-bg", "--hc-empty-fg"],
  [".hc-live-closed-state", "--hc-empty-bg", "--hc-empty-fg"],
  [".hc-womens-empty-state", "--hc-empty-bg", "--hc-empty-fg"],
  [".hc-coach-empty", "--hc-empty-bg", "--hc-empty-fg"],
  [".hc-review-state", "--hc-empty-bg", "--hc-empty-fg"],
  [".empty-state", "--hc-empty-bg", "--hc-empty-fg"],
  [".hc-live-state", "--hc-badge-neutral-bg", "--hc-badge-neutral-fg"],
  [".hc-live-badge", "--hc-badge-neutral-bg", "--hc-badge-neutral-fg"],
  [".hc-live-state--soon", "--hc-badge-live-bg", "--hc-badge-live-fg"],
  [".hc-remind-button", "--hc-button-outline-bg", "--hc-button-outline-fg"],
  [".hc-remind-button:disabled", "--hc-button-disabled-bg", "--hc-button-disabled-fg"],
  [".btn-primary", "--hc-button-primary-bg", "--hc-button-primary-fg"],
  [".btn-outline", "--hc-button-outline-bg", "--hc-button-outline-fg"],
  [".btn-ghost", "--hc-button-ghost-bg", "--hc-button-ghost-fg"],
];

const errors = [];
for (const [selector, bg, fg] of requiredPairs) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rule = contract.match(new RegExp(escaped + "[^{]*\\{([^}]*)\\}", "s"));
  if (!rule) {
    errors.push(`Missing paired selector: ${selector}`);
    continue;
  }
  if (!rule[1].includes(`var(${bg}`)) errors.push(`${selector} missing paired background token ${bg}`);
  if (!rule[1].includes(`var(${fg}`)) errors.push(`${selector} missing paired foreground token ${fg}`);
}

function luminance(hex) {
  const rgb = hex.replace("#", "").match(/.{2}/g).map(v => parseInt(v, 16) / 255)
    .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
const disabledPairs = [
  ["light disabled", "#555550", "#E8E8E4"],
  ["dark disabled", "#B8B8B3", "#292929"],
];
for (const [label, fg, bg] of disabledPairs) {
  const ratio = contrast(fg, bg);
  if (ratio < 4.5) errors.push(`${label} contrast ${ratio.toFixed(2)}:1 is below 4.5:1`);
  else console.log(`PASS ${label} contrast ${ratio.toFixed(2)}:1`);
}

if (errors.length) {
  console.error("THEME_PAIR_AUDIT=FAIL");
  for (const error of errors) console.error("- " + error);
  process.exitCode = 1;
} else {
  console.log("THEME_PAIR_AUDIT=PASS");
  console.log(`Verified ${requiredPairs.length} semantic component pairs and disabled-state contrast.`);
}
