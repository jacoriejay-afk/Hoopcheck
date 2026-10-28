import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

async function loadTypeScriptModule(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

const accountToken = await loadTypeScriptModule("../lib/billing/apple-iap-account-token.ts");
const ownership = await loadTypeScriptModule("../lib/billing/apple-iap-ownership.ts");
const classification = await loadTypeScriptModule("../lib/billing/apple-iap-classification.ts");
const entitlement = await loadTypeScriptModule("../lib/billing/effective-entitlement.ts");
const verifierConfig = await loadTypeScriptModule("../lib/billing/apple-iap-verifier-config.ts");
const notificationHandler = await loadTypeScriptModule("../lib/billing/apple-iap-notification-handler.ts");
const signedDataVerifierAdapter = await loadTypeScriptModule("../lib/billing/apple-iap-signed-data-verifier-adapter.ts");

let verifierConstructorArgs = null;
const fakeAppleLibrary = {
  Environment: { PRODUCTION: "APPLE_PRODUCTION", SANDBOX: "APPLE_SANDBOX" },
  SignedDataVerifier: class {
    constructor(...args) { verifierConstructorArgs = args; }
    async verifyAndDecodeNotification(value) { return { notificationUUID: value }; }
    async verifyAndDecodeTransaction(value) { return { transactionId: value }; }
    async verifyAndDecodeRenewalInfo(value) { return { productId: value }; }
  },
};
const fakeRootCertificate = Buffer.from("test-root-certificate");
const sandboxAppleVerifier = signedDataVerifierAdapter.createAppleNotificationVerifier(
  fakeAppleLibrary,
  {
    bundleId: "online.hoopcheck.app",
    environment: "Sandbox",
    rootCertificates: [fakeRootCertificate],
  },
);
assert.equal(verifierConstructorArgs[1], true, "online certificate checks default to enabled");
assert.equal(verifierConstructorArgs[2], "APPLE_SANDBOX");
assert.equal(verifierConstructorArgs[3], "online.hoopcheck.app");
assert.deepEqual(await sandboxAppleVerifier.verifyAndDecodeNotification("signed-notification"), {
  notificationUUID: "signed-notification",
});
assert.deepEqual(await sandboxAppleVerifier.verifyAndDecodeTransaction("signed-transaction"), {
  transactionId: "signed-transaction",
});
assert.deepEqual(await sandboxAppleVerifier.verifyAndDecodeRenewalInfo("signed-renewal"), {
  productId: "signed-renewal",
});
assert.throws(
  () => signedDataVerifierAdapter.createAppleNotificationVerifier(fakeAppleLibrary, {
    bundleId: "com.example.hoopcheck",
    environment: "Sandbox",
    rootCertificates: [fakeRootCertificate],
  }),
  signedDataVerifierAdapter.AppleVerifierAdapterConfigurationError,
  "placeholder bundle IDs must fail closed",
);
assert.throws(
  () => signedDataVerifierAdapter.createAppleNotificationVerifier(fakeAppleLibrary, {
    bundleId: "online.hoopcheck.app",
    environment: "Production",
    rootCertificates: [fakeRootCertificate],
  }),
  signedDataVerifierAdapter.AppleVerifierAdapterConfigurationError,
  "production verification must require the numeric Apple app ID",
);


const trustedAccountToken = "550e8400-e29b-41d4-a716-446655440000";
assert.equal(
  accountToken.matchesAppleAccountToken(trustedAccountToken, trustedAccountToken.toUpperCase()),
  true,
  "verified transaction token should match trusted stored token case-insensitively",
);
assert.equal(
  accountToken.matchesAppleAccountToken("550e8400-e29b-41d4-a716-446655440001", trustedAccountToken),
  false,
  "a different appAccountToken must not bind to this user",
);
assert.equal(accountToken.matchesAppleAccountToken(null, trustedAccountToken), false);
assert.equal(accountToken.matchesAppleAccountToken("not-a-uuid", trustedAccountToken), false);
assert.equal(accountToken.matchesAppleAccountToken(trustedAccountToken, undefined), false);

const ownedTransaction = {
  authenticatedUserId: "user-123",
  transactionVerified: true,
  transactionAppAccountToken: trustedAccountToken,
  expectedStoredToken: trustedAccountToken,
};
assert.deepEqual(ownership.checkAppleTransactionOwnership(ownedTransaction), { owned: true });
assert.deepEqual(
  ownership.checkAppleTransactionOwnership({ ...ownedTransaction, authenticatedUserId: " " }),
  { owned: false, reason: "unauthenticated" },
);
assert.deepEqual(
  ownership.checkAppleTransactionOwnership({ ...ownedTransaction, transactionVerified: false }),
  { owned: false, reason: "transaction_unverified" },
);
assert.deepEqual(
  ownership.checkAppleTransactionOwnership({ ...ownedTransaction, transactionAppAccountToken: null }),
  { owned: false, reason: "missing_transaction_token" },
);
assert.deepEqual(
  ownership.checkAppleTransactionOwnership({ ...ownedTransaction, expectedStoredToken: undefined }),
  { owned: false, reason: "missing_stored_token" },
);
assert.deepEqual(
  ownership.checkAppleTransactionOwnership({
    ...ownedTransaction,
    transactionAppAccountToken: "550e8400-e29b-41d4-a716-446655440001",
  }),
  { owned: false, reason: "token_mismatch" },
);

const productEnv = {
  APPLE_IAP_PRO_PRODUCT_ID: "online.hoopcheck.pro.monthly",
  APPLE_IAP_PREMIUM_PRODUCT_ID: "online.hoopcheck.premium.monthly",
};
assert.deepEqual(
  classification.getAllowedAppleProductIds(productEnv),
  ["online.hoopcheck.pro.monthly", "online.hoopcheck.premium.monthly"],
);
assert.deepEqual(classification.getAllowedAppleProductIds({}), []);
assert.deepEqual(
  classification.getAllowedAppleProductIds({
    APPLE_IAP_PRO_PRODUCT_ID: "same",
    APPLE_IAP_PREMIUM_PRODUCT_ID: "same",
  }),
  [],
);
assert.equal(classification.getApplePlanForProductId("online.hoopcheck.pro.monthly", productEnv), "pro");
assert.equal(classification.getApplePlanForProductId("online.hoopcheck.premium.monthly", productEnv), "premium");
assert.equal(classification.getApplePlanForProductId("unknown", productEnv), null);
assert.equal(classification.getApplePlanForProductId("online.hoopcheck.pro.monthly", {}), null);
assert.equal(classification.getApplePlanForProductId("same", {
  APPLE_IAP_PRO_PRODUCT_ID: "same",
  APPLE_IAP_PREMIUM_PRODUCT_ID: "same",
}), null);
assert.equal(classification.classifyAppleNotification("DID_RENEW"), "refresh_entitlement");
assert.equal(classification.classifyAppleNotification("REFUND"), "refresh_entitlement");
assert.equal(classification.classifyAppleNotification("UNRECOGNIZED_EVENT"), "record_only");

const now = new Date("2026-10-28T12:00:00.000Z");
const validApple = {
  plan: "premium",
  status: "active",
  environment: "Production",
  currentPeriodEnd: "2026-11-28T12:00:00.000Z",
  lastVerifiedAt: "2026-10-28T11:59:00.000Z",
};
assert.deepEqual(
  entitlement.resolveEffectiveEntitlement({ apple: [validApple], now }),
  { plan: "premium", sources: ["apple"] },
);
assert.equal(
  entitlement.resolveEffectiveEntitlement({
    apple: [{ ...validApple, environment: "Sandbox" }],
    now,
  }).plan,
  "free",
);
assert.equal(
  entitlement.resolveEffectiveEntitlement({
    apple: [{ ...validApple, lastVerifiedAt: null }],
    now,
  }).plan,
  "free",
);
assert.equal(
  entitlement.resolveEffectiveEntitlement({
    apple: [{ ...validApple, lastVerifiedAt: "not-a-timestamp" }],
    now,
  }).plan,
  "free",
);
assert.equal(
  entitlement.resolveEffectiveEntitlement({
    apple: [{ ...validApple, lastVerifiedAt: "2026-10-28T12:01:00.000Z" }],
    now,
  }).plan,
  "free",
);
assert.equal(
  entitlement.resolveEffectiveEntitlement({
    apple: [{ ...validApple, currentPeriodEnd: "2026-10-28T11:00:00.000Z" }],
    now,
  }).plan,
  "free",
);
assert.deepEqual(
  entitlement.resolveEffectiveEntitlement({
    stripe: { plan: "pro", status: "active", currentPeriodEnd: null },
    apple: [validApple],
    now,
  }),
  { plan: "premium", sources: ["apple"] },
);
assert.equal(
  entitlement.resolveEffectiveEntitlement({
    stripe: { plan: "premium", status: "canceled", currentPeriodEnd: null },
    now,
  }).plan,
  "free",
);

const validEnv = {
  APPLE_IAP_BUNDLE_ID: "online.hoopcheck.app",
  APPLE_ROOT_CA_CERTIFICATES_BASE64: Buffer.from("fixture-root").toString("base64"),
  APPLE_IAP_APPLE_ID: "1234567890",
};
const productionConfig = verifierConfig.getAppleVerifierConfiguration("Production", validEnv);
assert.equal(productionConfig.bundleId, "online.hoopcheck.app");
assert.equal(productionConfig.appAppleId, 1234567890);
assert.equal(productionConfig.rootCertificates.length, 1);
assert.throws(
  () => verifierConfig.getAppleVerifierConfiguration("Production", {
    ...validEnv,
    APPLE_IAP_BUNDLE_ID: "com.example.hoopcheck",
  }),
  verifierConfig.AppleIapConfigurationError,
);
assert.throws(
  () => verifierConfig.getAppleVerifierConfiguration("Sandbox", {
    ...validEnv,
    APPLE_ROOT_CA_CERTIFICATES_BASE64: "not base64!",
  }),
  verifierConfig.AppleIapConfigurationError,
);
assert.throws(
  () => verifierConfig.getAppleVerifierConfiguration("Production", {
    ...validEnv,
    APPLE_IAP_APPLE_ID: "",
  }),
  verifierConfig.AppleIapConfigurationError,
);


let verifyNotificationCalls = 0;
let verifyTransactionCalls = 0;
let reconcileCalls = 0;
let markProcessedCalls = 0;
let ledgerInserted = false;
let ledgerProcessed = false;
let shouldFailReconcile = false;
const verifiedNotification = {
  notificationUUID: "notification-123",
  notificationType: "DID_RENEW",
  data: {
    bundleId: "online.hoopcheck.app",
    environment: "Sandbox",
    signedTransactionInfo: "signed-transaction",
    signedRenewalInfo: "signed-renewal",
  },
};
const mockVerifier = {
  async verifyAndDecodeNotification(payload) {
    verifyNotificationCalls++;
    assert.equal(payload, "signed-notification");
    return verifiedNotification;
  },
  async verifyAndDecodeTransaction(payload) {
    verifyTransactionCalls++;
    assert.equal(payload, "signed-transaction");
    return {
      transactionId: "transaction-123",
      originalTransactionId: "original-123",
      bundleId: "online.hoopcheck.app",
      productId: "online.hoopcheck.pro.monthly",
      environment: "Sandbox",
      appAccountToken: "account-token",
      expiresDate: Date.parse("2026-11-28T12:00:00.000Z"),
    };
  },
  async verifyAndDecodeRenewalInfo(payload) {
    assert.equal(payload, "signed-renewal");
    return { originalTransactionId: "original-123", productId: "online.hoopcheck.pro.monthly", autoRenewStatus: 1 };
  },
};
const mockPersistence = {
  async recordVerifiedNotification() {
    const inserted = !ledgerInserted;
    ledgerInserted = true;
    return { inserted, processed: ledgerProcessed };
  },
  async reconcileVerifiedNotification() {
    reconcileCalls++;
    if (shouldFailReconcile) throw new Error("simulated transient DB failure");
  },
  async markNotificationProcessed() {
    markProcessedCalls++;
    ledgerProcessed = true;
  },
};
const notificationInput = {
  signedPayload: "signed-notification",
  expectedBundleId: "online.hoopcheck.app",
  allowedProductIds: ["online.hoopcheck.pro.monthly", "online.hoopcheck.premium.monthly"],
  verifier: mockVerifier,
  persistence: mockPersistence,
  allowedEnvironments: ["Sandbox"],
};

for (const malformedField of ["signedTransactionInfo", "signedRenewalInfo"]) {
  let malformedPayloadWrites = 0;
  const malformedPayloadVerifier = {
    ...mockVerifier,
    async verifyAndDecodeNotification() {
      return {
        ...verifiedNotification,
        data: {
          ...verifiedNotification.data,
          [malformedField]: "   ",
        },
      };
    },
  };
  await assert.rejects(
    notificationHandler.handleAppleServerNotification({
      ...notificationInput,
      verifier: malformedPayloadVerifier,
      persistence: {
        ...mockPersistence,
        async recordVerifiedNotification() {
          malformedPayloadWrites++;
          return { inserted: true, processed: false };
        },
        async reconcileVerifiedNotification() { malformedPayloadWrites++; },
        async markNotificationProcessed() { malformedPayloadWrites++; },
      },
    }),
    notificationHandler.AppleNotificationRejectedError,
    `malformed ${malformedField} must be rejected`,
  );
  assert.equal(
    malformedPayloadWrites,
    0,
    `malformed ${malformedField} must be rejected before persistence`,
  );
}
for (const invalidAllowlist of [
  [],
  ["online.hoopcheck.pro.monthly", "online.hoopcheck.pro.monthly"],
  [" online.hoopcheck.pro.monthly", "online.hoopcheck.premium.monthly"],
]) {
  let invalidAllowlistWrites = 0;
  await assert.rejects(
    notificationHandler.handleAppleServerNotification({
      ...notificationInput,
      allowedProductIds: invalidAllowlist,
      persistence: {
        ...mockPersistence,
        async recordVerifiedNotification() {
          invalidAllowlistWrites++;
          return { inserted: true, processed: false };
        },
      },
    }),
    notificationHandler.AppleNotificationRejectedError,
  );
  assert.equal(invalidAllowlistWrites, 0, "invalid product allowlists must fail before persistence");
}
for (const invalidEnvironments of [[], ["Production", "Production"], ["Development"]]) {
  let invalidEnvironmentVerifications = 0;
  await assert.rejects(
    notificationHandler.handleAppleServerNotification({
      ...notificationInput,
      allowedEnvironments: invalidEnvironments,
      verifier: {
        ...mockVerifier,
        async verifyAndDecodeNotification(payload) {
          invalidEnvironmentVerifications++;
          return mockVerifier.verifyAndDecodeNotification(payload);
        },
      },
    }),
    notificationHandler.AppleNotificationRejectedError,
  );
  assert.equal(
    invalidEnvironmentVerifications,
    0,
    "invalid environment allowlists must fail before verifying or writing",
  );
}

let productionOnlyWrites = 0;
await assert.rejects(
  notificationHandler.handleAppleServerNotification({
    ...notificationInput,
    allowedEnvironments: ["Production"],
    persistence: {
      ...mockPersistence,
      async recordVerifiedNotification() {
        productionOnlyWrites++;
        return { inserted: true, processed: false };
      },
      async reconcileVerifiedNotification() { productionOnlyWrites++; },
      async markNotificationProcessed() { productionOnlyWrites++; },
    },
  }),
  notificationHandler.AppleNotificationRejectedError,
);
assert.equal(
  productionOnlyWrites,
  0,
  "Sandbox notifications must not reach persistence when production-only mode is configured",
);

let mismatchedTransactionEnvironmentWrites = 0;
await assert.rejects(
  notificationHandler.handleAppleServerNotification({
    ...notificationInput,
    verifier: {
      ...mockVerifier,
      async verifyAndDecodeTransaction() {
        return {
          transactionId: "transaction-123",
          originalTransactionId: "original-123",
          bundleId: "online.hoopcheck.app",
          productId: "online.hoopcheck.pro.monthly",
          environment: "Production",
          appAccountToken: trustedAccountToken,
        };
      },
    },
    persistence: {
      ...mockPersistence,
      async recordVerifiedNotification() { mismatchedTransactionEnvironmentWrites++; return { inserted: true, processed: false }; },
      async reconcileVerifiedNotification() { mismatchedTransactionEnvironmentWrites++; },
      async markNotificationProcessed() { mismatchedTransactionEnvironmentWrites++; },
    },
  }),
  notificationHandler.AppleNotificationRejectedError,
);
assert.equal(
  mismatchedTransactionEnvironmentWrites,
  0,
  "nested transaction environment mismatch must fail before persistence",
);

const notificationCountsBeforeHappyPath = {
  verifyNotificationCalls,
  verifyTransactionCalls,
  reconcileCalls,
  markProcessedCalls,
};
const handled = await notificationHandler.handleAppleServerNotification(notificationInput);
assert.deepEqual(handled, { outcome: "recorded", notificationUUID: "notification-123" });
assert.equal(verifyNotificationCalls, notificationCountsBeforeHappyPath.verifyNotificationCalls + 1);
assert.equal(verifyTransactionCalls, notificationCountsBeforeHappyPath.verifyTransactionCalls + 1);
assert.equal(reconcileCalls, notificationCountsBeforeHappyPath.reconcileCalls + 1);
assert.equal(markProcessedCalls, notificationCountsBeforeHappyPath.markProcessedCalls + 1);
const duplicate = await notificationHandler.handleAppleServerNotification(notificationInput);
assert.deepEqual(duplicate, { outcome: "duplicate", notificationUUID: "notification-123" });
assert.equal(
  reconcileCalls,
  notificationCountsBeforeHappyPath.reconcileCalls + 1,
  "processed duplicates must not reconcile twice",
);

const invalidBundleVerifier = {
  ...mockVerifier,
  async verifyAndDecodeNotification() {
    return { ...verifiedNotification, data: { ...verifiedNotification.data, bundleId: "wrong.bundle" } };
  },
};
let invalidBundleWrites = 0;
await assert.rejects(
  notificationHandler.handleAppleServerNotification({
    ...notificationInput,
    verifier: invalidBundleVerifier,
    persistence: {
      ...mockPersistence,
      async recordVerifiedNotification() { invalidBundleWrites++; return { inserted: true, processed: false }; },
      async reconcileVerifiedNotification() { invalidBundleWrites++; },
      async markNotificationProcessed() { invalidBundleWrites++; },
    },
  }),
  notificationHandler.AppleNotificationRejectedError,
);
assert.equal(invalidBundleWrites, 0, "wrong bundle must fail before persistence");

let incompleteTransactionWrites = 0;
await assert.rejects(
  notificationHandler.handleAppleServerNotification({
    ...notificationInput,
    verifier: {
      ...mockVerifier,
      async verifyAndDecodeTransaction() {
        return {
          bundleId: "online.hoopcheck.app",
          environment: "Sandbox",
          originalTransactionId: "original-123",
          transactionId: "transaction-123",
          // productId intentionally missing
        };
      },
    },
    persistence: {
      ...mockPersistence,
      async recordVerifiedNotification() {
        incompleteTransactionWrites++;
        return { inserted: true, processed: false };
      },
      async reconcileVerifiedNotification() { incompleteTransactionWrites++; },
      async markNotificationProcessed() { incompleteTransactionWrites++; },
    },
  }),
  notificationHandler.AppleNotificationRejectedError,
);
assert.equal(
  incompleteTransactionWrites,
  0,
  "verified transactions missing product identity must fail before persistence",
);

let missingAccountTokenWrites = 0;
await assert.rejects(
  notificationHandler.handleAppleServerNotification({
    ...notificationInput,
    verifier: {
      ...mockVerifier,
      async verifyAndDecodeTransaction() {
        return {
          transactionId: "transaction-no-token",
          originalTransactionId: "original-no-token",
          bundleId: "online.hoopcheck.app",
          productId: "online.hoopcheck.pro.monthly",
          environment: "Sandbox",
          appAccountToken: null,
        };
      },
    },
    persistence: {
      ...mockPersistence,
      async recordVerifiedNotification() { missingAccountTokenWrites++; return { inserted: true, processed: false }; },
      async reconcileVerifiedNotification() { missingAccountTokenWrites++; },
      async markNotificationProcessed() { missingAccountTokenWrites++; },
    },
  }),
  notificationHandler.AppleNotificationRejectedError,
);
assert.equal(
  missingAccountTokenWrites,
  0,
  "verified transactions without a valid account token must fail before persistence",
);

let mismatchedRenewalWrites = 0;
await assert.rejects(
  notificationHandler.handleAppleServerNotification({
    ...notificationInput,
    verifier: {
      ...mockVerifier,
      async verifyAndDecodeRenewalInfo() {
        return { originalTransactionId: "original-123", productId: "online.hoopcheck.premium.monthly" };
      },
    },
    persistence: {
      ...mockPersistence,
      async recordVerifiedNotification() {
        mismatchedRenewalWrites++;
        return { inserted: true, processed: false };
      },
      async reconcileVerifiedNotification() { mismatchedRenewalWrites++; },
      async markNotificationProcessed() { mismatchedRenewalWrites++; },
    },
  }),
  notificationHandler.AppleNotificationRejectedError,
);
assert.equal(
  mismatchedRenewalWrites,
  0,
  "renewal metadata for a different product must fail before persistence",
);

let unknownProductWrites = 0;
await assert.rejects(
  notificationHandler.handleAppleServerNotification({
    ...notificationInput,
    verifier: {
      ...mockVerifier,
      async verifyAndDecodeTransaction() {
        return {
          transactionId: "transaction-unknown",
          originalTransactionId: "original-unknown",
          bundleId: "online.hoopcheck.app",
          productId: "online.hoopcheck.unregistered.monthly",
          environment: "Sandbox",
        };
      },
    },
    persistence: {
      ...mockPersistence,
      async recordVerifiedNotification() {
        unknownProductWrites++;
        return { inserted: true, processed: false };
      },
      async reconcileVerifiedNotification() { unknownProductWrites++; },
      async markNotificationProcessed() { unknownProductWrites++; },
    },
  }),
  notificationHandler.AppleNotificationRejectedError,
);
assert.equal(unknownProductWrites, 0, "unregistered products must fail before persistence");

ledgerInserted = false;
ledgerProcessed = false;
shouldFailReconcile = true;
await assert.rejects(
  notificationHandler.handleAppleServerNotification({
    ...notificationInput,
    persistence: {
      ...mockPersistence,
      async recordVerifiedNotification() {
        const inserted = !ledgerInserted;
        ledgerInserted = true;
        return { inserted, processed: ledgerProcessed };
      },
      async reconcileVerifiedNotification() { throw new Error("simulated transient DB failure"); },
      async markNotificationProcessed() { ledgerProcessed = true; },
    },
  }),
  /simulated transient DB failure/,
);
shouldFailReconcile = false;
const retry = await notificationHandler.handleAppleServerNotification({
  ...notificationInput,
  persistence: {
    ...mockPersistence,
    async recordVerifiedNotification() {
      const inserted = !ledgerInserted;
      ledgerInserted = true;
      return { inserted, processed: ledgerProcessed };
    },
    async reconcileVerifiedNotification() { reconcileCalls++; },
    async markNotificationProcessed() { ledgerProcessed = true; },
  },
});
assert.deepEqual(retry, { outcome: "duplicate", notificationUUID: "notification-123" });
assert.equal(ledgerProcessed, true, "retry must complete an unprocessed notification");



// Mobile account-token client contract tests (fetch is mocked; no network calls).
const mobileAccountToken = await loadTypeScriptModule("../apps/mobile/src/billing/apple-account-token.ts");
const expectedAppAccountToken = "550e8400-e29b-41d4-a716-446655440000";
let tokenRequestUrl = "";
let tokenRequestHeaders = {};
let tokenRequestMethod = "";
const mobileToken = await mobileAccountToken.getAppleAppAccountToken(
  "https://hoopcheck.example/",
  "supabase-access-token",
  async (input, init) => {
    tokenRequestUrl = String(input);
    tokenRequestHeaders = init.headers;
    tokenRequestMethod = init.method;
    return new Response(JSON.stringify({ appAccountToken: expectedAppAccountToken }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  },
);
assert.equal(mobileToken, expectedAppAccountToken);
assert.equal(tokenRequestUrl, "https://hoopcheck.example/api/apple-iap/account-token");
assert.equal(tokenRequestMethod, "POST", "token provisioning must use POST");
assert.equal(tokenRequestHeaders.Authorization, "Bearer supabase-access-token");
assert.equal(tokenRequestHeaders.Accept, "application/json");
await assert.rejects(
  mobileAccountToken.getAppleAppAccountToken("https://hoopcheck.example", "", async () => {
    throw new Error("fetch must not run without a token");
  }),
  mobileAccountToken.AppleAccountTokenError,
);
await assert.rejects(
  mobileAccountToken.getAppleAppAccountToken("http://untrusted.example", "access-token", async () => {
    throw new Error("fetch must not run for an insecure origin");
  }),
  mobileAccountToken.AppleAccountTokenError,
);
await assert.rejects(
  mobileAccountToken.getAppleAppAccountToken("https://hoopcheck.example", "access-token", async () =>
    new Response(JSON.stringify({ appAccountToken: "not-a-uuid" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  ),
  mobileAccountToken.AppleAccountTokenError,
);


const appleCandidate = await loadTypeScriptModule("../lib/billing/apple-iap-entitlement-candidate.ts");
const originalProductEnv = {
  APPLE_IAP_PRO_PRODUCT_ID: process.env.APPLE_IAP_PRO_PRODUCT_ID,
  APPLE_IAP_PREMIUM_PRODUCT_ID: process.env.APPLE_IAP_PREMIUM_PRODUCT_ID,
};
process.env.APPLE_IAP_PRO_PRODUCT_ID = "online.hoopcheck.pro.monthly";
process.env.APPLE_IAP_PREMIUM_PRODUCT_ID = "online.hoopcheck.premium.monthly";
const candidateNow = new Date("2026-10-28T12:00:00.000Z");
const verifiedProductionTransaction = {
  transactionId: "tx-123",
  originalTransactionId: "orig-123",
  productId: "online.hoopcheck.pro.monthly",
  environment: "Production",
  appAccountToken: trustedAccountToken,
  expiresDate: Date.parse("2026-11-28T12:00:00.000Z"),
  revocationDate: null,
};
const candidateInput = {
  authenticatedUserId: "user-123",
  transactionVerified: true,
  transaction: verifiedProductionTransaction,
  expectedStoredToken: trustedAccountToken,
  now: candidateNow,
};
const acceptedCandidate = appleCandidate.buildAppleEntitlementCandidate(candidateInput);
assert.equal(acceptedCandidate.accepted, true, "owned verified production transaction should produce candidate");
assert.deepEqual(acceptedCandidate.candidate, {
  plan: "pro",
  status: "active",
  environment: "Production",
  currentPeriodEnd: "2026-11-28T12:00:00.000Z",
  lastVerifiedAt: "2026-10-28T12:00:00.000Z",
  revokedAt: null,
});
assert.equal(appleCandidate.buildAppleEntitlementCandidate({
  ...candidateInput,
  transaction: { ...verifiedProductionTransaction, environment: "Sandbox" },
}).reason, "non_production_environment");
assert.equal(appleCandidate.buildAppleEntitlementCandidate({
  ...candidateInput,
  transaction: { ...verifiedProductionTransaction, revocationDate: Date.parse("2026-10-27T12:00:00.000Z") },
}).reason, "revoked");
assert.equal(appleCandidate.buildAppleEntitlementCandidate({
  ...candidateInput,
  transaction: { ...verifiedProductionTransaction, expiresDate: Date.parse("2026-10-27T12:00:00.000Z") },
}).reason, "expired");
assert.equal(appleCandidate.buildAppleEntitlementCandidate({
  ...candidateInput,
  transaction: { ...verifiedProductionTransaction, productId: "unregistered.product" },
}).reason, "unknown_product");
assert.equal(appleCandidate.buildAppleEntitlementCandidate({
  ...candidateInput,
  transaction: { ...verifiedProductionTransaction, appAccountToken: "550e8400-e29b-41d4-a716-446655440001" },
}).reason, "token_mismatch");
assert.equal(appleCandidate.buildAppleEntitlementCandidate({
  ...candidateInput,
  transactionVerified: false,
}).reason, "transaction_unverified");
assert.equal(appleCandidate.buildAppleEntitlementCandidate({
  ...candidateInput,
  authenticatedUserId: "",
}).reason, "unauthenticated");
assert.equal(appleCandidate.buildAppleEntitlementCandidate({
  ...candidateInput,
  transaction: { ...verifiedProductionTransaction, expiresDate: Number.NaN },
}).reason, "invalid_expiration");
assert.equal(appleCandidate.buildAppleEntitlementCandidate({
  ...candidateInput,
  now: new Date("invalid"),
}).reason, "invalid_expiration");
assert.equal(appleCandidate.buildAppleEntitlementCandidate({
  ...candidateInput,
  transaction: { ...verifiedProductionTransaction, transactionId: " " },
}).reason, "missing_transaction_identity");
const graceCandidate = appleCandidate.buildAppleEntitlementCandidate({
  ...candidateInput,
  transaction: { ...verifiedProductionTransaction, expiresDate: Date.parse("2026-10-27T12:00:00.000Z") },
  renewalInfo: { gracePeriodExpiresDate: Date.parse("2026-10-30T12:00:00.000Z") },
});
assert.equal(graceCandidate.accepted, true, "unexpired verified grace period should be eligible");
assert.equal(graceCandidate.candidate.status, "grace_period");
assert.equal(graceCandidate.candidate.currentPeriodEnd, "2026-10-30T12:00:00.000Z");
if (originalProductEnv.APPLE_IAP_PRO_PRODUCT_ID === undefined) {
  delete process.env.APPLE_IAP_PRO_PRODUCT_ID;
} else {
  process.env.APPLE_IAP_PRO_PRODUCT_ID = originalProductEnv.APPLE_IAP_PRO_PRODUCT_ID;
}
if (originalProductEnv.APPLE_IAP_PREMIUM_PRODUCT_ID === undefined) {
  delete process.env.APPLE_IAP_PREMIUM_PRODUCT_ID;
} else {
  process.env.APPLE_IAP_PREMIUM_PRODUCT_ID = originalProductEnv.APPLE_IAP_PREMIUM_PRODUCT_ID;
}


process.env.APPLE_IAP_PRO_PRODUCT_ID = "same.product";
process.env.APPLE_IAP_PREMIUM_PRODUCT_ID = "same.product";
assert.equal(
  appleCandidate.buildAppleEntitlementCandidate({
    ...candidateInput,
    transaction: { ...verifiedProductionTransaction, productId: "same.product" },
  }).reason,
  "unknown_product",
  "duplicate Pro/Premium product configuration must fail closed",
);
process.env.APPLE_IAP_PRO_PRODUCT_ID = "online.hoopcheck.pro.monthly";
process.env.APPLE_IAP_PREMIUM_PRODUCT_ID = "online.hoopcheck.premium.monthly";

const activeStripePro = { plan: "pro", status: "active", currentPeriodEnd: "2026-11-28T12:00:00.000Z" };
const activeStripePremium = { plan: "premium", status: "active", currentPeriodEnd: "2026-11-28T12:00:00.000Z" };
const activeApplePro = { ...validApple, plan: "pro" };
assert.deepEqual(
  entitlement.resolveEffectiveEntitlement({ stripe: activeStripePro, apple: [activeApplePro], now }),
  { plan: "pro", sources: ["stripe", "apple"] },
  "equivalent active Pro subscriptions from both providers should preserve both sources",
);
assert.deepEqual(
  entitlement.resolveEffectiveEntitlement({ stripe: activeStripePremium, apple: [activeApplePro], now }),
  { plan: "premium", sources: ["stripe"] },
  "a lower Apple tier must not replace an active Stripe Premium entitlement",
);
assert.deepEqual(
  entitlement.resolveEffectiveEntitlement({
    stripe: activeStripePro,
    apple: [{ ...validApple, revokedAt: "2026-10-27T12:00:00.000Z" }],
    now,
  }),
  { plan: "pro", sources: ["stripe"] },
  "a revoked Apple candidate must not remove a valid Stripe entitlement",
);
assert.deepEqual(
  entitlement.resolveEffectiveEntitlement({
    stripe: { plan: "pro", status: "active", currentPeriodEnd: "2026-10-27T12:00:00.000Z" },
    apple: [activeApplePro],
    now,
  }),
  { plan: "pro", sources: ["apple"] },
  "an expired Stripe candidate must not block a valid Apple candidate",
);

console.log("Apple IAP primitive tests passed (local pure-logic checks only).");
