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

const classification = await loadTypeScriptModule("../lib/billing/apple-iap-classification.ts");
const entitlement = await loadTypeScriptModule("../lib/billing/effective-entitlement.ts");
const verifierConfig = await loadTypeScriptModule("../lib/billing/apple-iap-verifier-config.ts");
const notificationHandler = await loadTypeScriptModule("../lib/billing/apple-iap-notification-handler.ts");

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
const handled = await notificationHandler.handleAppleServerNotification(notificationInput);
assert.deepEqual(handled, { outcome: "recorded", notificationUUID: "notification-123" });
assert.equal(verifyNotificationCalls, 1);
assert.equal(verifyTransactionCalls, 1);
assert.equal(reconcileCalls, 1);
assert.equal(markProcessedCalls, 1);
const duplicate = await notificationHandler.handleAppleServerNotification(notificationInput);
assert.deepEqual(duplicate, { outcome: "duplicate", notificationUUID: "notification-123" });
assert.equal(reconcileCalls, 1, "processed duplicates must not reconcile twice");

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

console.log("Apple IAP primitive tests passed (local pure-logic checks only).");
