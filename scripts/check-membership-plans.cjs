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

test("active non-Stripe memberships remain managed by their verified provider, not by new checkout", () => {
  const page = read("app/membership/page.tsx");
  assert.match(page, /getActiveMembershipTier\(subscription\)/);
  assert.match(page, /getEffectiveMembership\(user\.id\)/);
  assert.match(page, /isActive && subscription &&/);
  assert.match(page, /subscription\.provider === "manual"/);
  assert.match(page, /subscription\.provider === "apple"/);
  assert.match(page, /!loading && !isActive && accountType && accountType !== "fan"/);
  assert.match(page, /!stripeOngoing && !appleOngoing/);
});

test("team directory list and map send session bearer token for trust scores", () => {
  const page = read("app/teams/page.tsx");
  assert.match(page, /const trustHeaders: Record<string, string> = session\?\.access_token \? \{ Authorization: `Bearer \$\{session\.access_token\}` \} : \{\};/);
  assert.match(page, /fetch\(`\/api\/trust-score\?entityType=team&entityIds=\$\{batch\.map\(encodeURIComponent\)\.join\(","\)\}`, \{ headers: trustHeaders, cache: "no-store" \}\)/);
  assert.match(page, /headers: session\?\.access_token \? \{ Authorization: `Bearer \$\{session\.access_token\}` \} : \{\}, cache: "no-store"/);
});

test("monthly trial notice discloses supported roles without enabling unpriced Fan checkout", () => {
  const page = read("app/membership/page.tsx");
  const checkout = read("app/api/stripe/webhook/create-checkout/route.ts");
  assert.ok(page.includes('billingInterval === "month"'));
  assert.ok(!page.includes('accountType === "player" && billingInterval === "month"'));
  assert.ok(page.includes("all supported HoopCheck account types"));
  assert.ok(page.includes("not currently available at public checkout"));
  assert.ok(page.includes('accountType === "fan"'));
  assert.ok(page.includes("Paid fan products have not been priced"));
  assert.match(checkout, /checkoutProfile\.account_type === "fan"/);
});

test("disabled Checkout trial cannot be advertised as active by its read-only status endpoint", () => {
  const page = read("app/membership/page.tsx");
  const statusEndpoint = read("app/api/membership/trial-status/route.ts");
  const checkout = read("app/api/stripe/webhook/create-checkout/route.ts");
  assert.ok(page.includes("not currently available at public checkout"));
  assert.match(checkout, /const trialRolloutEnabled = false;/);
  assert.match(statusEndpoint, /const trialActivationApproved = false;/);
  assert.match(statusEndpoint, /trialActivationApproved && canEnableProductionSevenDayTrial\(\{/);
  assert.ok(statusEndpoint.includes('"Cache-Control": "no-store, max-age=0"'));
  assert.ok(statusEndpoint.includes("stripeMatchesDeployment(process.env.STRIPE_SECRET_KEY)"));
});

test("checkout rejects equal and lower active tiers even without a Stripe subscription ID", () => {
  const checkout = fs.readFileSync("app/api/stripe/webhook/create-checkout/route.ts", "utf8");
  const tiers = fs.readFileSync("lib/membership-tier.ts", "utf8");
  assert.match(checkout, /stripe_subscription_id, status, plan, current_period_end/);
  assert.match(checkout, /const currentTier = getActiveMembershipTier\(existingSubscription\)/);
  assert.match(checkout, /if \(hasStripeSubscription \|\| !canStartNewMembershipCheckout\(currentTier, plan\)\)/);
  assert.match(tiers, /return !isAtLeastTier\(currentTier, requestedTier\)/);
});


test("Stripe cancellation stays owner-bound and never mutates Apple billing", () => {
  const page = read("app/membership/page.tsx");
  const api = read("app/api/stripe/cancel-subscription/route.ts");
  assert.match(page, /stripeOngoing = Boolean\(billing\?\.stripe_subscription_id/);
  assert.match(page, /"active", "trialing", "past_due", "unpaid"/);
  assert.match(page, /billingAction\("cancel", "\/api\/stripe\/cancel-subscription"/);
  assert.match(page, /billing\.cancel_at_period_end \? "resume" : "cancel"/);
  assert.match(page, /Cancel Membership/);
  assert.match(page, /Stripe controls cannot change Apple billing/);
  assert.ok(api.includes("stripe.subscriptions.update(subscription.stripe_subscription_id"));
  assert.ok(api.includes('cancel_at_period_end: action === "cancel"'));
});

test("manual-grant membership has a real owner billing support path", () => {
  const page = read("app/membership/page.tsx");
  const support = read("app/support/page.tsx");
  assert.match(page, /subscription\.provider === "manual"/);
  assert.match(page, /href="\/support\?membershipCancellation=1"/);
  assert.match(page, /Contact support to change a membership managed by HoopCheck/);
  assert.ok(support.includes('get("membershipCancellation") === "1"'));
  assert.ok(support.includes('setCategory("billing")'));
});

test("membership and shared cards use contained borders, equal radii and responsive controls", () => {
  const css = read("app/globals.css");
  const comparison = read("components/MembershipComparison.tsx");
  assert.ok(!comparison.includes('style={{border:currentTier'),
    "Current plans may not use inline extra-width borders");
  assert.ok(css.includes(".hc-membership-page .hc-membership-plan.is-current"),
    "Plan comparison must follow shared border styling");
  assert.ok(css.includes("outline-offset: -3px"), "Membership keyboard focus stays inside borders");
  assert.ok(css.includes(".hc-membership-page .hc-membership-actions"), "Actions need the shared responsive layout");
  assert.ok(css.includes(".dashboard-card::after { content: none; }"), "Decorative overflow must be removed");
  assert.ok(css.includes(".hc-membership-page .plan-top"), "Mobile price and title must wrap");
});


test("membership auth switching and loading cannot expose active purchase choices", () => {
  const page = read("app/membership/page.tsx");
  assert.match(page, /const generation = useRef\(0\), acting = useRef\(false\), authEpoch = useRef\(0\)/);
  assert.match(page, /const current = \+\+generation\.current/);
  assert.match(page, /setLoading\(true\)/);
  assert.match(page, /if \(current !== generation\.current \|\| controller\.signal\.aborted\) return/);
  assert.match(page, /if \(captured !== authEpoch\.current\) return/);
  assert.match(page, /!loading && !isActive && accountType && accountType !== "fan"/);
  assert.match(page, /disabled=\{!canBuy \|\| Boolean\(busy\)\}/);
  assert.match(page, /<HoopLoading label="Verifying membership and billing/);
});
