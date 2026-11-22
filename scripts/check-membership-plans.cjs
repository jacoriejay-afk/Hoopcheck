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
  assert.ok(page.includes("showMembershipManagement && subscription ? ("), "Billing management remains available behind a stable loading state");
  assert.ok(page.includes("subscription.stripe_subscription_id ? ("),
    "Stripe and manual grants must use different honest cancellation controls");
});


test("team directory list and map send session bearer token for trust scores", () => {
  const page = read("app/teams/page.tsx");
  assert.match(page, /const trustHeaders: Record<string, string> = session\?\.access_token \? \{ Authorization: `Bearer \$\{session\.access_token\}` \} : \{\};/);
  assert.match(page, /fetch\(`\/api\/trust-score\?entityType=team&entityIds=\$\{batch\.map\(encodeURIComponent\)\.join\(","\)\}`, \{ headers: trustHeaders, cache: "no-store" \}\)/);
  assert.match(page, /headers: session\?\.access_token \? \{ Authorization: `Bearer \$\{session\.access_token\}` \} : \{\}, cache: "no-store"/);
});

test("trial notice covers all account types and monthly terms only", () => {
  const page = read("app/membership/page.tsx");
  assert.ok(page.includes('{billingInterval === "month" && ('),
    "All accounts should see the monthly trial notice");
  assert.ok(page.includes('<p className="hc-trial-note"'),
    "Trial note must remain visible");
  assert.ok(!page.includes('accountType === "player" && billingInterval === "month"'),
    "Trial note must not be Player-only");
  assert.ok(page.includes("not currently available at public checkout"),
    "Do not advertise the trial as live");
  assert.ok(page.includes("all supported HoopCheck account types"),
    "Disclose the full role coverage");
});

test("public trial display is read from the same fail-closed server activation boundary", () => {
  const page = read("app/membership/page.tsx");
  const statusEndpoint = read("app/api/membership/trial-status/route.ts");
  assert.ok(page.includes('fetch("/api/membership/trial-status"'),
    "Membership page must check the server availability, not a browser flag");
  assert.ok(page.includes("trialPubliclyAvailable ? ("),
    "Live trial offer is displayed only when the server says it is available");
  assert.ok(page.includes("not currently available at public checkout"),
    "Fallback must not promise the trial until activation is verified");
  assert.ok(statusEndpoint.includes("canEnableProductionSevenDayTrial({"),
    "Offer status must use the canonical production gate");
  assert.ok(statusEndpoint.includes("Cache-Control") && statusEndpoint.includes("no-store"),
    "Offer status cannot be cached through activation changes");
  assert.ok(statusEndpoint.includes("stripeMatchesDeployment(process.env.STRIPE_SECRET_KEY)"),
    "Offer status must recheck Stripe key mode");
});

test("checkout rejects equal and lower active tiers even without a Stripe subscription ID", () => {
  const checkout = fs.readFileSync("app/api/stripe/webhook/create-checkout/route.ts", "utf8");
  const tiers = fs.readFileSync("lib/membership-tier.ts", "utf8");
  assert.match(checkout, /stripe_subscription_id, status, plan, current_period_end/);
  assert.match(checkout, /const currentTier = getActiveMembershipTier\(existingSubscription\)/);
  assert.match(checkout, /if \(hasStripeSubscription \|\| !canStartNewMembershipCheckout\(currentTier, plan\)\)/);
  assert.match(tiers, /return !isAtLeastTier\(currentTier, requestedTier\)/);
});


test("Stripe cancellation is visible for active, trialing and overdue membership states", () => {
  const page = read("app/membership/page.tsx");
  const cancelApi = read("app/api/stripe/cancel-subscription/route.ts");
  assert.match(page, /hasManageableSubscription = Boolean\(subscription\?\.stripe_subscription_id/);
  assert.match(page, /"active", "trialing", "past_due", "unpaid"/);
  assert.match(page, /showMembershipManagement && subscription/);
  assert.ok(page.includes('"Cancel Subscription"'), "A direct cancel button must exist");
  assert.ok(page.includes("onClick={cancelMembership}"), "Cancel control must submit authenticated cancellation");
  assert.ok(page.includes('data?.cancel_at_period_end !== true'), "UI must wait for Stripe cancellation confirmation");
  assert.ok(page.includes("Automatic renewal is off"), "Do not imply immediate loss of access or instant cancellation");
  assert.ok(cancelApi.includes("stripe.subscriptions.update(subscription.stripe_subscription_id"),
    "Server must keep using the owner-bound subscription record");
  assert.ok(cancelApi.includes('cancel_at_period_end: action === "cancel"'),
    "Server must cancel at period end rather than immediately");
});

test("non-Stripe memberships have a clearly explained billing support path", () => {
  const page = read("app/membership/page.tsx");
  const support = read("app/support/page.tsx");
  assert.ok(page.includes('/support?membershipCancellation=1'),
    "Manual-grant subscriptions need a visible cancellation-request path");
  assert.ok(page.includes("no linked Stripe subscription"),
    "Manual memberships must not pretend they have a Stripe renewal");
  assert.ok(support.includes('get("membershipCancellation") === "1"'),
    "Support page should prefill billing cancellation tickets");
  assert.ok(support.includes('setCategory("billing")'),
    "Cancellation requests must enter the billing queue");
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


test("membership loading does not flash purchase choices during subscription refresh", () => {
  const page = read("app/membership/page.tsx");
  const css = read("app/globals.css");
  assert.ok(page.includes("async function loadSubscription(silent = false)"), "Polling must support a quiet refresh");
  assert.ok(page.includes("await loadSubscription(true)"), "Checkout return polling must not hide cancellation controls");
  assert.ok(page.includes("{loading ? ("), "Initial membership state must not show purchase cards before loading");
  assert.ok(page.includes('className="hc-membership-loading"'), "Loading state must have stable layout");
  assert.ok(css.includes(".hc-membership-page .hc-membership-loading {"), "Loading state must use shared card styling");
});
