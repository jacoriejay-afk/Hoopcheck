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
  "canSubmitPayCheckIn", "canUseAskPlayer",
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
    canReadFullReviews:true, canViewTrustScore:true, canWriteReviews:true,
    canUseLiveGameHub:true, canUseLiveGameChat:true, canUseFanGroups:false,
    canModerateFanGroups:false, canCompare:true, canUseContractCheck:true,
    canUseProPassport:true, canUsePayOnTimeIndex:true, canViewTeamPayHistory:true,
    canSubmitPayCheckIn:true, canUseAskPlayer:true,
  }],
  ["Fan Free", { accountType: "fan" }, {
    canReadFullReviews:false, canViewTrustScore:false, canWriteReviews:false,
    canUseLiveGameHub:false, canUseLiveGameChat:false, canUseFanGroups:true,
    canModerateFanGroups:false, canCompare:false, canUseContractCheck:false,
    canUseProPassport:false, canUsePayOnTimeIndex:false, canViewTeamPayHistory:false,
    canSubmitPayCheckIn:false, canUseAskPlayer:false,
  }],
  ["Fan Pro", { accountType: "fan", subscription: active("pro") }, {
    canReadHoopFeed:false, canWriteHoopFeed:false, canReadFanFeed:true, canWriteFanFeed:true,
    canReadFullReviews:false, canViewTrustScore:false, canWriteReviews:false,
    canUseLiveGameHub:true, canUseLiveGameChat:true, canUseFanGroups:true,
    canModerateFanGroups:false, canCompare:true, canUseContractCheck:false,
    canUseProPassport:false, canUsePayOnTimeIndex:false, canViewTeamPayHistory:false,
    canSubmitPayCheckIn:false, canUseAskPlayer:false,
  }],
  ["Fan Premium", { accountType: "fan", subscription: active("premium") }, {
    canReadFullReviews:true, canViewTrustScore:true, canWriteReviews:false,
    canUseLiveGameHub:true, canUseLiveGameChat:true, canUseFanGroups:true,
    canModerateFanGroups:false, canCompare:true, canUseContractCheck:false,
    canUseProPassport:false, canUsePayOnTimeIndex:false, canViewTeamPayHistory:false,
    canSubmitPayCheckIn:false, canUseAskPlayer:false,
  }],
  ["Coach", { accountType: "coach", subscription: active("pro") }, {
    canReadFullReviews:true, canViewTrustScore:true, canWriteReviews:false,
    canUseLiveGameHub:false, canUseLiveGameChat:false, canUseFanGroups:false,
    canModerateFanGroups:false, canCompare:true, canUseContractCheck:true,
    canUseProPassport:false, canUsePayOnTimeIndex:true, canViewTeamPayHistory:true,
    canSubmitPayCheckIn:false, canUseAskPlayer:false,
  }],
  ["Agent", { accountType: "agent", subscription: active("pro") }, {
    canReadFullReviews:true, canViewTrustScore:true, canWriteReviews:false,
    canUseLiveGameHub:false, canUseLiveGameChat:false, canUseFanGroups:false,
    canModerateFanGroups:false, canCompare:true, canUseContractCheck:true,
    canUseProPassport:true, canUsePayOnTimeIndex:true, canViewTeamPayHistory:true,
    canSubmitPayCheckIn:false, canUseAskPlayer:true,
  }],
  ["Club admin", { accountType: "club_admin", subscription: active("pro") }, {
    canReadFullReviews:true, canViewTrustScore:true, canWriteReviews:false,
    canUseLiveGameHub:false, canUseLiveGameChat:false, canUseFanGroups:false,
    canModerateFanGroups:true, canCompare:true, canUseContractCheck:true,
    canUseProPassport:false, canUsePayOnTimeIndex:true, canViewTeamPayHistory:true,
    canSubmitPayCheckIn:false, canUseAskPlayer:false,
  }],
  ["Signed out", { accountType: null }, {
    canReadFullReviews:false, canViewTrustScore:false, canWriteReviews:false,
    canUseLiveGameHub:false, canUseLiveGameChat:false, canUseFanGroups:false,
    canModerateFanGroups:false, canCompare:false, canUseContractCheck:false,
    canUseProPassport:false, canUsePayOnTimeIndex:false, canViewTeamPayHistory:false,
    canSubmitPayCheckIn:false, canUseAskPlayer:false,
  }],
];

for (const [label, input, expected] of cases) {
  const actual = getHoopCheckEntitlements(input);
  for (const key of keys) assert.equal(actual[key], expected[key], label + " → " + key);
}

const expired = getHoopCheckEntitlements({
  accountType: "player",
  subscription: { ...active("premium"), current_period_end: "2000-01-01T00:00:00.000Z" },
  playerVerified: true,
});
assert.equal(expired.canReadFullReviews, false, "expired Premium must not retain Pro access");
assert.equal(expired.canSubmitPayCheckIn, false, "expired Premium must not submit pay check-ins");

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

console.log("VERIFY-1 entitlement matrix: " + cases.length + " role/tier cells and edge cases passed (" + keys.length + " entitlements).");
