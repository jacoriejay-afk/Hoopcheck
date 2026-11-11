import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/membership-tier.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUrl = "data:text/javascript;base64," + Buffer.from(compiled).toString("base64");
const { getHoopCheckEntitlements } = await import(moduleUrl);

const active = (plan) => ({ plan, status: "active", access_status: "active" });
const keys = [
  "canReadHoopFeed", "canWriteHoopFeed", "canReadFanFeed", "canWriteFanFeed",
  "canReadFullReviews", "canViewTrustScore", "canWriteReviews",
  "canUseLiveGameHub", "canUseLiveGameChat", "canUseFanGroups",
  "canModerateFanGroups", "canCompare", "canUseContractCheck",
  "canUseProPassport", "canUsePayOnTimeIndex", "canViewTeamPayHistory",
  "canSubmitPayCheckIn", "canUseAskPlayer", "canConnectWithFans",
  "canSwitchBasketballSide", "canStartCoachIdentityVerification", "canUseRecruitingNetwork",
];

const cases = [
  ["Player Free", { accountType: "player" }, {
    canReadHoopFeed:false, canWriteHoopFeed:false, canReadFanFeed:false, canWriteFanFeed:false,
    canReadFullReviews:false, canViewTrustScore:false, canWriteReviews:false,
    canUseLiveGameHub:false, canUseLiveGameChat:false, canUseFanGroups:false,
    canModerateFanGroups:false, canCompare:false, canUseContractCheck:false,
    canUseProPassport:false, canUsePayOnTimeIndex:false, canViewTeamPayHistory:true,
    canSubmitPayCheckIn:false, canUseAskPlayer:false,
  }],
  ["Player Pro", { accountType: "player", subscription: active("pro"), playerVerified:true }, {
    canReadHoopFeed:true, canWriteHoopFeed:true, canReadFanFeed:false, canWriteFanFeed:false,
    canReadFullReviews:true, canViewTrustScore:true, canWriteReviews:true,
    canUseLiveGameHub:true, canUseLiveGameChat:true, canUseFanGroups:false,
    canModerateFanGroups:false, canCompare:true, canUseContractCheck:true,
    canUseProPassport:false, canUsePayOnTimeIndex:true, canViewTeamPayHistory:true,
    canSubmitPayCheckIn:true, canUseAskPlayer:true,
  }],
  ["Player Premium", { accountType: "player", subscription: active("premium"), playerVerified:true }, {
    canReadHoopFeed:true, canWriteHoopFeed:true, canReadFanFeed:false, canWriteFanFeed:false,
    canReadFullReviews:true, canViewTrustScore:true, canWriteReviews:true,
    canUseLiveGameHub:true, canUseLiveGameChat:true, canUseFanGroups:false,
    canModerateFanGroups:false, canCompare:true, canUseContractCheck:true,
    canUseProPassport:true, canUseRecruitingNetwork:true, canUsePayOnTimeIndex:true, canViewTeamPayHistory:true,
    canSubmitPayCheckIn:true, canUseAskPlayer:true,
  }],
  ["Fan Free", { accountType: "fan" }, {
    canReadHoopFeed:false, canWriteHoopFeed:false, canReadFanFeed:false, canWriteFanFeed:false,
    canReadFullReviews:false, canViewTrustScore:false, canWriteReviews:false,
    canUseLiveGameHub:false, canUseLiveGameChat:false, canUseFanGroups:true,
    canModerateFanGroups:false, canCompare:false, canUseContractCheck:false,
    canUseProPassport:false, canUsePayOnTimeIndex:false, canViewTeamPayHistory:false,
    canSubmitPayCheckIn:false, canUseAskPlayer:false,
  }],
  ["Fan Pro", { accountType: "fan", subscription: active("pro") }, {
    canReadHoopFeed:true, canWriteHoopFeed:true, canReadFanFeed:true, canWriteFanFeed:true,
    canReadFullReviews:false, canViewTrustScore:false, canWriteReviews:false,
    canUseLiveGameHub:true, canUseLiveGameChat:true, canUseFanGroups:true,
    canModerateFanGroups:false, canCompare:true, canUseContractCheck:false,
    canUseProPassport:false, canUsePayOnTimeIndex:false, canViewTeamPayHistory:false,
    canSubmitPayCheckIn:false, canUseAskPlayer:false,
    canConnectWithFans:true, canSwitchBasketballSide:true,
  }],
  ["Fan Premium", { accountType: "fan", subscription: active("premium") }, {
    canReadHoopFeed:true, canWriteHoopFeed:true, canReadFanFeed:true, canWriteFanFeed:true,
    canReadFullReviews:true, canViewTrustScore:true, canWriteReviews:false,
    canUseLiveGameHub:true, canUseLiveGameChat:true, canUseFanGroups:true,
    canModerateFanGroups:false, canCompare:true, canUseContractCheck:false,
    canUseProPassport:false, canUsePayOnTimeIndex:false, canViewTeamPayHistory:false,
    canSubmitPayCheckIn:false, canUseAskPlayer:false,
    canConnectWithFans:true, canSwitchBasketballSide:true,
  }],
  ["Coach", { accountType: "coach", subscription: active("pro") }, {
    canReadHoopFeed:true, canWriteHoopFeed:true, canReadFanFeed:false, canWriteFanFeed:false,
    canReadFullReviews:true, canViewTrustScore:true, canWriteReviews:false,
    canUseLiveGameHub:false, canUseLiveGameChat:false, canUseFanGroups:false,
    canModerateFanGroups:false, canCompare:true, canUseContractCheck:true,
    canUseProPassport:false, canUsePayOnTimeIndex:true, canViewTeamPayHistory:true,
    canSubmitPayCheckIn:false, canUseAskPlayer:false,
    canStartCoachIdentityVerification:true,
  }],
  ["Agent", { accountType: "agent", subscription: active("pro") }, {
    canReadHoopFeed:true, canWriteHoopFeed:true, canReadFanFeed:false, canWriteFanFeed:false,
    canReadFullReviews:true, canViewTrustScore:true, canWriteReviews:false,
    canUseLiveGameHub:false, canUseLiveGameChat:false, canUseFanGroups:false,
    canModerateFanGroups:false, canCompare:true, canUseContractCheck:true,
    canUseProPassport:true, canUsePayOnTimeIndex:true, canViewTeamPayHistory:true,
    canSubmitPayCheckIn:false, canUseAskPlayer:true,
  }],
  ["Club admin", { accountType: "club_admin", subscription: active("pro") }, {
    canReadHoopFeed:true, canWriteHoopFeed:true, canReadFanFeed:false, canWriteFanFeed:false,
    canReadFullReviews:true, canViewTrustScore:true, canWriteReviews:false,
    canUseLiveGameHub:false, canUseLiveGameChat:false, canUseFanGroups:false,
    canModerateFanGroups:true, canCompare:true, canUseContractCheck:true,
    canUseProPassport:false, canUsePayOnTimeIndex:true, canViewTeamPayHistory:true,
    canSubmitPayCheckIn:false, canUseAskPlayer:false,
  }],
  ["Signed out", { accountType: null }, {
    canReadHoopFeed:false, canWriteHoopFeed:false, canReadFanFeed:false, canWriteFanFeed:false,
    canReadFullReviews:false, canViewTrustScore:false, canWriteReviews:false,
    canUseLiveGameHub:false, canUseLiveGameChat:false, canUseFanGroups:false,
    canModerateFanGroups:false, canCompare:false, canUseContractCheck:false,
    canUseProPassport:false, canUsePayOnTimeIndex:false, canViewTeamPayHistory:false,
    canSubmitPayCheckIn:false, canUseAskPlayer:false,
  }],
];

for (const [label, input, expected] of cases) {
  const actual = getHoopCheckEntitlements(input);
  for (const key of keys) assert.equal(actual[key], expected[key] ?? false, label + " → " + key);
}

// Unified community posting: all recognized paid roles can post; unknown role values cannot.
for (const role of ["player", "fan", "coach", "scout", "agent", "club_admin"]) {
  const allowed = getHoopCheckEntitlements({ accountType: role, subscription: active("pro") });
  assert.equal(allowed.canReadHoopFeed, true, role + " Pro reads unified HoopFeed");
  assert.equal(allowed.canWriteHoopFeed, true, role + " Pro posts to unified HoopFeed");
  const free = getHoopCheckEntitlements({ accountType: role });
  assert.equal(free.canWriteHoopFeed, false, role + " Free cannot post to unified HoopFeed");
}
const unknownRole = getHoopCheckEntitlements({ accountType: "unexpected_role", subscription: active("premium") });
assert.equal(unknownRole.canReadHoopFeed, false, "unrecognized roles cannot read member HoopFeed");
assert.equal(unknownRole.canWriteHoopFeed, false, "unrecognized roles cannot post to HoopFeed");
assert.equal(unknownRole.canReadFullReviews, false, "unrecognized roles cannot inherit review access");
assert.equal(unknownRole.canViewTrustScore, false, "unrecognized roles cannot inherit trust access");
assert.equal(unknownRole.canViewTeamPayHistory, false, "unrecognized roles cannot access team pay history");

const expired = getHoopCheckEntitlements({
  accountType: "player",
  subscription: { ...active("premium"), current_period_end: "2000-01-01T00:00:00.000Z" },
  playerVerified: true,
});
assert.equal(expired.canReadFullReviews, false, "expired Premium must not retain Pro access");
assert.equal(expired.canSubmitPayCheckIn, false, "expired Premium must not submit pay check-ins");

// Administrator authorization is independent of a paid membership, but moderator access is not.
const adminWithoutSubscription = getHoopCheckEntitlements({ accountType: "player", isAdmin: true });
assert.equal(adminWithoutSubscription.canReadHoopFeed, true, "admin must read HoopFeed without a subscription");
assert.equal(adminWithoutSubscription.canWriteHoopFeed, true, "admin must write HoopFeed without a subscription");
const moderatorWithoutSubscription = getHoopCheckEntitlements({ accountType: "player", isAdmin: false });
assert.equal(moderatorWithoutSubscription.canReadHoopFeed, false, "moderator must not inherit admin read access");
assert.equal(moderatorWithoutSubscription.canWriteHoopFeed, false, "moderator must not inherit admin write access");
assert.equal(expired.canWriteHoopFeed, false, "expired Premium must not post to HoopFeed");

const trialing = getHoopCheckEntitlements({
  accountType: "player",
  subscription: { plan: "premium", status: "trialing", access_status: "trialing" },
  playerVerified: true,
});
assert.equal(trialing.canWriteReviews, true, "trialing Premium inherits Pro access");

const unverified = getHoopCheckEntitlements({
  accountType: "player", subscription: active("premium"), playerVerified: false,
});
assert.equal(unverified.canWriteReviews, false, "unverified players cannot write reviews");
assert.equal(unverified.canSubmitPayCheckIn, false, "unverified player cannot submit pay check-ins");


// Guard against checking HoopFeed membership before the authoritative admin role is known.
const feedPageSource = readFileSync(new URL("../app/feed/page.tsx", import.meta.url), "utf8");
const feedModerationSource = readFileSync(new URL("../app/api/hoopfeed/moderate/route.ts", import.meta.url), "utf8");
assert.match(feedPageSource, /isAdmin:adminRole==="admin"/, "HoopFeed page must pass admin role to entitlements");
assert.match(feedPageSource, /isAdmin:resolvedAdminRole==="admin"/, "HoopFeed initial gate must use resolved admin role");
assert.ok(feedPageSource.indexOf('setAdminRole(resolvedAdminRole)') < feedPageSource.indexOf('const memberActive='), "resolve admin role before initial membership gate");
assert.ok(feedModerationSource.includes("getHoopCheckEntitlements({ accountType: profile?.account_type, subscription: sub, isAdmin })"), "moderation API must use admin-aware entitlements");
assert.ok(feedModerationSource.indexOf('const isAdmin = (adminRoleRows') < feedModerationSource.indexOf('if (!entitlements.canWriteHoopFeed)'), "server must resolve admin before write gate");

const read = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");
const menProfile = read("../app/teams/[id]/page.tsx");
const womenProfile = read("../app/womens/[id]/page.tsx");
const coachProfile = read("../app/coaches/[id]/page.tsx");
const leagueProfile = read("../app/leagues/[id]/page.tsx");
const liveChat = read("../app/fan-live/page.tsx");
const liveHub = read("../app/live-games/page.tsx");
const payApi = read("../app/api/team-pay-checkins/route.ts");
const trustApi = read("../app/api/trust-score/route.ts");
const membershipPage = read("../app/membership/page.tsx");
const accountPage = read("../app/account/page.tsx");
const fanConnection = read("../components/FanConnectionButton.tsx");

for (const [label, page] of [["men's team", menProfile], ["women's team", womenProfile]]) {
  assert.match(page, /import TeamProfileHero/, label + " must use the shared team hero");
  assert.equal((page.match(/<ReviewMembershipGate/g) || []).length, 1, label + " must render exactly one shared review gate");
}
for (const [label, page] of [["coach", coachProfile], ["league", leagueProfile]]) {
  assert.equal((page.match(/<ReviewMembershipGate/g) || []).length, 1, label + " must render exactly one shared review gate");
}
assert.match(menProfile, /accountType !== "fan"/, "fan profiles must not render the team Pay tab");
assert.match(menProfile, /\["coach", "manager", "club_admin", "admin"\]\.includes\(accountType\)/, "Team Portal must be role-gated");
assert.match(menProfile, /href="\/team-dashboard"/, "Team Portal link must remain present for managers");
assert.match(payApi, /entitlements\.canViewTeamPayHistory/, "payment-history API must enforce the shared role entitlement");
assert.match(liveChat, /from\("womens_teams"\)/, "Live Game Chat must resolve women's teams");
assert.match(liveChat, /opponent_team_id/, "Live Game Chat must resolve both fixture sides");
assert.match(liveChat, /canUseLiveGameChat/, "Live Game Chat must use the shared chat entitlement");
assert.match(liveHub, /womens_teams/, "Live Game Hub must include women's teams");
assert.match(trustApi, /row\.womens_team_id/, "women's Trust Score must aggregate women's reviews");
assert.match(membershipPage, /Built for fans who follow the game/, "Fan membership page must not use player upsell copy");
assert.match(membershipPage, /HOOPCHECK FAN PRO/, "Fan Pro plan must be role-labelled");
assert.match(membershipPage, /HOOPCHECK FAN PREMIUM/, "Fan Premium plan must be role-labelled");
assert.match(accountPage, /entitlements\.canUseRecruitingNetwork/, "Premium recruiting upsell must be player-only");
assert.match(fanConnection, /accountType !== "fan"/, "fan connection gates must be hidden from non-fans");




assert.match(feedModerationSource, /submittedImages\.length > 4/, "HoopFeed must reject uploads exceeding four photos");

assert.match(feedModerationSource, /kind === "comment" && \(allImages\.length > 0 \|\| videoPath\)/, "comments must reject every image attachment field");

assert.match(feedModerationSource, /const optionIndex = \/\^\\d\+\$\/\.test\(optionIndexText\) \? Number\(optionIndexText\) : NaN/, "poll option must be an explicitly supplied decimal integer");


assert.match(feedModerationSource, /new Set\(cleaned\.map\(\(option\) => option\.toLocaleLowerCase\(\)\)\)\.size !== cleaned\.length/, "poll choices must be distinct regardless of case");

assert.match(feedModerationSource, /if \(!text\) return NextResponse\.json\(\{ allowed: false, message: "Write a comment before posting\." \}/, "empty comments must be rejected");

assert.match(feedModerationSource, /kind === "post" && !text && allImages\.length === 0 && !videoPath/, "posts must contain text or media");

assert.match(feedModerationSource, /gameDayTeam\.toLocaleLowerCase\(\) === gameDayOpponent\.toLocaleLowerCase\(\)/, "Game Day posts must use distinct teams");

assert.match(feedModerationSource, /submittedKind === "news" && !isAdmin/, "official news posting must explicitly reject non-admin users");

assert.match(feedModerationSource, /typeof option !== "string" \|\| option\.trim\(\)\.length === 0 \|\| option\.trim\(\)\.length > 60/, "poll options must be nonempty strings of at most 60 characters");

assert.match(feedModerationSource, /imageValues\.length > 1/, "multiple primary image fields must not be silently discarded");

assert.match(feedModerationSource, /extraImageValues\.some\(\(value\) => !\(value instanceof File\) \|\| value\.size === 0\)/, "malformed and empty additional photo attachments must be rejected");

assert.match(feedModerationSource, /imageValue !== null && \(!\(imageValue instanceof File\) \|\| imageValue\.size === 0\)/, "invalid or empty primary photo must be rejected");

assert.match(feedModerationSource, /kindValues\.length > 1 \|\| \(kindValues\.length === 1 && typeof kindValues\[0\] !== "string"\)/, "ambiguous or malformed action fields must be rejected");

assert.match(feedModerationSource, /textValues\.length > 1 \|\| \(textValues\.length === 1 && typeof textValues\[0\] !== "string"\)/, "duplicate or non-text HoopFeed body fields must be rejected");

assert.match(feedModerationSource, /postKindValues\.length > 1/, "duplicate post kind fields must be rejected");
assert.match(feedModerationSource, /!\["discussion", "poll", "news"\]\.includes\(submittedKind\)/, "unknown post types must be rejected instead of silently converted");

assert.match(feedModerationSource, /const cleanupUploadedImages = async/, "uploaded photos must have failure cleanup");
assert.match(feedModerationSource, /uploadedImagePaths\.push\(path\)/, "track each successfully uploaded photo for cleanup");

assert.match(feedModerationSource, /pollOptionValues\.length !== 1 \|\| typeof pollOptionValues\[0\] !== "string"/, "poll option payload must be one text field");

assert.match(feedModerationSource, /postIdValues\.length !== 1/, "all HoopFeed actions must reject duplicate or missing post IDs");
assert.match(feedModerationSource, /const actionPostId = kind === "post"/, "actions must use the validated post ID");

assert.match(feedModerationSource, /optionIndexValues\.length === 1 && typeof optionIndexValues\[0\] === "string"/, "poll votes must reject duplicate or non-text option indices");

assert.match(feedModerationSource, /savedValues\.length !== 1/, "bookmarks require one explicit saved state");
assert.match(feedModerationSource, /pinnedValues\.length !== 1/, "pins require one explicit pinned state");

assert.match(feedModerationSource, /videoPathValues\.length > 1 \|\| videoTypeValues\.length > 1/, "video fields must reject duplicates");
assert.match(feedModerationSource, /\(videoPath && !videoType\) \|\| \(!videoPath && videoType\)/, "video upload path and type must be paired");

assert.match(feedModerationSource, /videoPath && allImages\.length > 0/, "posts cannot mix photos and videos");

assert.match(feedModerationSource, /\/\^\\d\{1,3\}\$\/\.test\(scoreForRaw\)/, "Game Day scores must be decimal integers");
assert.match(feedModerationSource, /\/\^\\d\{1,3\}\$\/\.test\(scoreAgainstRaw\)/, "Opponent scores must be decimal integers");

assert.match(feedModerationSource, /expires_at:null/, "new HoopFeed posts must be permanent");
assert.match(feedModerationSource, /const expiresAt = null/, "reshares must be permanent");
assert.doesNotMatch(feedModerationSource, /2100-01-01/, "posts must not use far-future expiry sentinels");
const unifiedFeedPolicy = read("../supabase/migrations/20261111233000_unify_hoopfeed_read_and_checks_rls.sql");
assert.match(unifiedFeedPolicy, /DROP POLICY IF EXISTS "player experience feed read"/, "old follower feed policy must be replaced");
assert.match(unifiedFeedPolicy, /ALTER TABLE public.feed_posts ALTER COLUMN expires_at DROP DEFAULT/, "permanent feed must remove 24-hour database default");
assert.match(unifiedFeedPolicy, /DROP POLICY IF EXISTS "player feed comments read"/, "comment reads must use unified feed permissions");
assert.doesNotMatch(unifiedFeedPolicy, /expires_at > now\(\)/, "permanent feed policies must not expire posts");
assert.match(unifiedFeedPolicy, /DROP POLICY IF EXISTS "player feed checks insert"/, "old player-only checks policy must be replaced");
assert.match(unifiedFeedPolicy, /'player','fan','coach','scout','agent','club_admin','admin'/, "unified feed must include recognized account types");
assert.match(unifiedFeedPolicy, /s\.current_period_end IS NULL OR s\.current_period_end > now\(\)/, "checks must respect membership expiration");
assert.match(unifiedFeedPolicy, /coalesce\(sub\.access_status,'active'\) IN/, "feed reads must preserve subscription access status");
assert.match(unifiedFeedPolicy, /coalesce\(s\.access_status,'active'\) IN/, "checks must preserve subscription access status");
assert.match(unifiedFeedPolicy, /fp\.status = 'approved'/, "checks must target approved posts");

const permanentFeedAnalytics = read("../supabase/migrations/20261111234500_permanent_hoopfeed_analytics.sql");
assert.match(permanentFeedAnalytics, /'feed_posts_total',\(select count\(\*\) from public.feed_posts\)/, "permanent HoopFeed must have a total-post KPI");
assert.match(permanentFeedAnalytics, /'feed_posts_24h',\(select count\(\*\) from public.feed_posts where created_at >= now\(\)-interval '24 hours'\)/, "24-hour activity must count post creation, not expiry");
assert.doesNotMatch(permanentFeedAnalytics, /expires_at > now\(\)/, "permanent HoopFeed analytics must not use expiration");

const playerContactPolicy = read("../supabase/migrations/20261111180000_align_agent_scout_contact_pro_premium.sql");
assert.match(playerContactPolicy, /s\.plan IN \('pro', 'premium'\)/, "Agent/Scout contact RLS must accept Pro and Premium");
assert.match(playerContactPolicy, /requester_id = \(SELECT auth\.uid\(\)\)/, "contact requester must match auth user");
assert.match(playerContactPolicy, /s\.status IN \('active', 'trialing'\)/, "contact RLS must require active or trialing subscription");
assert.match(playerContactPolicy, /target\.profile_visibility = 'public'/, "target player must be public");
assert.match(playerContactPolicy, /target\.moderation_status <> 'suspended'/, "suspended target must be denied");

console.log("VERIFY-1 entitlement matrix: " + cases.length + " role/tier cells and edge cases passed (" + keys.length + " entitlements).");
