import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(path,"utf8");

// Production's legacy installed iPhone profile contract currently lacks the
// protected owner RPC, so all web owner surfaces must use the compatibility
// reader while keeping Build 9's provider-aware membership authorization.
for (const path of [
  "app/account/page.tsx","app/dashboard/page.tsx","app/profile/page.tsx",
  "app/players/[id]/page.tsx"
]) {
  const source=read(path);
  assert.match(source,/readOwnProfile/,path+": missing safe owner adapter");
  assert.doesNotMatch(source,/getOwnProfile\(supabase/,path+": direct unavailable owner RPC");
}
for (const path of ["app/account/page.tsx","app/dashboard/page.tsx","app/players/[id]/page.tsx"])
  assert.match(read(path),/getEffectiveMembership\(/,path+": lost provider-aware entitlements");

const search=read("app/search/page.tsx");
assert.match(search,/supabase\.rpc\("search_public_players_by_username"/,
  "Exact username results must use consent-filtering server RPC");
assert.doesNotMatch(search.slice(search.indexOf("wantsPlayers && username && page === 1"),search.indexOf("wantsPlayers && username && page === 1")+750),/\.from\("profiles"\)/,
  "Username exact match must not fall back to raw private-table search");

const checkout=read("app/api/stripe/webhook/create-checkout/route.ts");
for(const required of [
  "applePreventsStripeCheckout","AppleBillingError",
  "isSupportedSubscriptionAccountType(checkoutProfile.account_type)",
  "moderation_status", "account_deletion_requests",
  "const trialRolloutEnabled = false;", "reserve_stripe_trial",
  "bind_stripe_trial_session"
]) assert.ok(checkout.includes(required),"Checkout lost protected rule: "+required);
const webhook=read("app/api/stripe/webhook/route.ts");
for(const required of [
  "isSupportedSubscriptionAccountType(ownerProfile.account_type)",
  "redeem_stripe_trial","mark_expired_stripe_trial"
]) assert.ok(webhook.includes(required),"Stripe webhook lost lifecycle check: "+required);
const membership=read("app/membership/page.tsx");
for(const required of [
  "getEffectiveMembership(user.id)","apple_memberships","subscription?.provider === \"apple\"",
  "Paid fan products have not been priced","not currently available at public checkout",
  "Stripe invoices and cancellation affect Stripe billing only."
]) assert.ok(membership.includes(required),"Membership lost provider/role protection: "+required);

const feed=read("apps/mobile/app/feed.tsx");
for(const required of [
  "CourtsideBanner","BrandLogo","MediaPostComposer","publishFeedPoll",
  "blockAccount(","hideCreator(","hideReel(","blockedCreators.failed",
  "hoopcheck:reels:hidden:","hoopcheck:reels:muted-creators:",
  "Report this Reel","Block this HoopCheck account"
]) assert.ok(feed.includes(required),"Arena HoopFeed lost UI/moderation feature: "+required);
assert.match(feed,/blockedCreators\.owner === uid && blockedCreators\.ready && !blockedCreators\.failed/,
  "Blocked-account lookup must fail closed before Reels appear");
assert.ok(feed.includes('<FlatList key={scope}'), "Posts/Reels and user scope changes must remount the VirtualizedList before its dynamic viewability rules change");
assert.match(feed, /supabase\.from\("user_blocks"\)\.insert\(/, "Native Reel blocking must use INSERT-only RLS privilege");
assert.doesNotMatch(feed, /supabase\.from\("user_blocks"\)\.upsert\(/, "Do not require UPDATE on owner-only block rows");
assert.match(feed, /error\.code !== "23505"/, "Repeated block attempts must verify the owner-scoped existing row");

const pkg=JSON.parse(read("apps/mobile/package.json"));
const lock=JSON.parse(read("apps/mobile/package-lock.json"));
assert.equal(pkg.devDependencies.sharp,lock.packages[""].devDependencies.sharp,
  "Do not import an unmatched mobile dependency manifest");
console.log("PASS: Build 9 main reconciliation preserves web owner access, provider billing and native Reel safety");
