/* eslint-disable @typescript-eslint/no-require-imports -- Register a TypeScript require hook for this standalone Node test. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (module, filename) => {
    const source = fs.readFileSync(filename, "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    module._compile(output, filename);
  };
}

const Comparison = require("../components/MembershipComparison.tsx").default;
const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const render = (props = {}) => renderToStaticMarkup(React.createElement(Comparison, {
  audience: "player", currentTier: "free", billingTerm: "month", onSelect: () => {}, ...props,
}));

test("coach and manager comparison offers Premium, not Pro", () => {
  const html = render({ premiumOnly: true });
  assert.match(html, /Choose Premium/);
  assert.doesNotMatch(html, /Choose Pro/);
  assert.match(html, /coaches and team managers/i);
});

test("other audiences keep both paid choices and current prices", () => {
  for (const audience of ["player", "fan"]) {
    const html = render({ audience, billingTerm: "year" });
    assert.match(html, /Choose Pro/);
    assert.match(html, /Choose Premium/);
    assert.match(html, /\$50\.90/);
    assert.match(html, /\$101\.90/);
  }
});

test("checkout choices are disabled during loading", () => {
  const html = render({ premiumOnly: true, purchaseDisabled: true });
  assert.match(html, /<button[^>]*disabled[^>]*>Choose Premium/);
});

test("role selection, server enforcement, and profile constraint remain aligned", () => {
  const page = read("app/membership/page.tsx");
  assert.match(page, /accountType === "coach" \|\| accountType === "manager"/);
  assert.match(page, /premiumOnly=\{premiumOnlyAccount\}/);
  const checkout = read("app/api/stripe/webhook/create-checkout/route.ts");
  assert.match(checkout, /\["coach", "manager"\]\.includes\(checkoutProfile\.account_type\) && plan !== "premium"/);
  const migration = read("supabase/migrations/20261031120000_allow_manager_profile_account_type.sql");
  for (const role of ["player", "coach", "manager", "scout", "agent", "fan"]) {
    assert.match(migration, new RegExp(`'${role}'::text`));
  }
});

test("membership page uses approved shared prices instead of stale hardcoded totals", () => {
  const page = read("app/membership/page.tsx");
  const prices = read("lib/plan-comparison.ts");
  assert.match(page, /PLAN_PRICES\.pro\[billingInterval\]/);
  assert.match(page, /PLAN_PRICES\.premium\[billingInterval\]/);
  for (const amount of ["$26.95", "$53.95", "$50.90", "$101.90"]) {
    assert.ok(prices.includes(amount), `Approved price missing: ${amount}`);
  }
  for (const obsolete of ["$25.45", "$50.95", "$53.89", "$107.89"]) {
    assert.ok(!page.includes(obsolete), `Obsolete display price remains: ${obsolete}`);
  }
});


test("current Pro and Premium plans are labeled and cannot be repurchased in comparison", () => {
  for (const currentTier of ["pro", "premium"]) {
    const html = render({ currentTier, audience: "player" });
    assert.match(html, /CURRENT/);
    assert.doesNotMatch(html, new RegExp(`Choose ${currentTier === "pro" ? "Pro" : "Premium"}<`));
  }
});

test("active non-Stripe memberships use the shared tier and do not render checkout cards", () => {
  const page = read("app/membership/page.tsx");
  assert.match(page, /getActiveMembershipTier\(subscription\)/);
  assert.match(page, /\{isActive && subscription && \(/);
  assert.match(page, /\{subscription\.stripe_subscription_id && <button/);
});


test("team directory list and map send session bearer token for trust scores", () => {
  const page = read("app/teams/page.tsx");
  assert.match(page, /const trustHeaders: Record<string, string> = session\?\.access_token \? \{ Authorization: `Bearer \$\{session\.access_token\}` \} : \{\};/);
  assert.match(page, /fetch\(`\/api\/trust-score\?entityType=team&entityIds=\$\{batch\.map\(encodeURIComponent\)\.join\(","\)\}`, \{ headers: trustHeaders, cache: "no-store" \}\)/);
  assert.match(page, /headers: session\?\.access_token \? \{ Authorization: `Bearer \$\{session\.access_token\}` \} : \{\}, cache: "no-store"/);
});
