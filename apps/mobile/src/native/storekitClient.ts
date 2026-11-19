import { appleProduct } from "../../../../lib/billing/apple-products";
import { parseEffectiveMembership, type EffectiveMembership } from "../../../../lib/billing/membership";
import { readWithDeadline } from "./readDeadline";

export type StoreProduct = {
  id: string; title: string; displayPrice: string; price: string; currency: string;
  groupID: string; months: number; trialDays: number; appleIntroEligible: boolean;
};
export type StoreTransaction = { id: string; originalID: string; productID: string; accountToken: string; signedJWS: string };
export type StoreBridge = {
  identity(): Promise<unknown>; products(): Promise<unknown>;
  purchase(id: string, owner: string, identityID: string, introJWS: string, price: string, currency: string): Promise<unknown>;
  transactions(): Promise<unknown>; restore(): Promise<unknown>; finish(id: string): Promise<void>; manage(): Promise<void>;
};
export type StoreRequest = (path: string, token: string, body?: Record<string, unknown>) => Promise<unknown>;
type Scope = { owner: string; epoch: number; token: string };
export type PreparedPurchase = {
  product: StoreProduct; owner: string; appTransactionID: string; environment: string;
  introductorySignature: string; hasTrial: boolean; trialEligibility: string;
  createdAt: number; epoch: number;
};
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Membership information could not be verified.");
  return value as Record<string, unknown>;
};
const identifier = (value: unknown): value is string => typeof value === "string" && /^[0-9]{1,64}$/.test(value);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const jws = (value: unknown): value is string => typeof value === "string" && value.length >= 100 && value.length <= 32768 && /^[\w-]+\.[\w-]+\.[\w-]+$/.test(value);
export function storeProducts(value: unknown): StoreProduct[] {
  if (!Array.isArray(value) || value.length > 6) throw Error("Apple membership products need attention.");
  const products = value.map(item => {
    const row = record(item), rule = appleProduct(row.id);
    if (!rule || row.months !== rule.months || row.trialDays !== rule.trialDays ||
      typeof row.title !== "string" || !row.title.trim() || row.title.length > 200 ||
      typeof row.displayPrice !== "string" || !row.displayPrice.trim() || row.displayPrice.length > 100 ||
      typeof row.price !== "string" || !/^\d{1,10}(\.\d{1,6})?$/.test(row.price) || Number(row.price) <= 0 ||
      typeof row.currency !== "string" || !/^[A-Z]{3}$/.test(row.currency) ||
      typeof row.groupID !== "string" || !identifier(row.groupID) || typeof row.appleIntroEligible !== "boolean") throw Error("Apple membership products need attention.");
    return row as StoreProduct;
  });
  if (new Set(products.map(item => item.id)).size !== products.length || new Set(products.map(item => item.groupID)).size > 1) throw Error("Apple membership products need attention.");
  return products;
}
function transaction(value: unknown): StoreTransaction {
  const row = record(value);
  if (!identifier(row.id) || !identifier(row.originalID) || !appleProduct(row.productID) ||
    typeof row.accountToken !== "string" || !uuid.test(row.accountToken) || !jws(row.signedJWS)) throw Error("This purchase could not be matched to a HoopCheck account. Sign in to the original account to restore it.");
  return { ...row, accountToken: row.accountToken.toLowerCase() } as StoreTransaction;
}
export function createStoreKitClient(deps: {
  native: StoreBridge | null;
  session(): Promise<{ id: string; token: string } | null>;
  request: StoreRequest;
  onSynced(): void;
  available?(): boolean;
}) {
  let owner: string | null = null, epoch = 0, presenting = false;
  const syncing = new Map<string, Promise<boolean>>();
  const acknowledged = new Map<string, { signed: string; at: number }>();
  const bridge = () => { if (!deps.native) throw Error("Apple purchases need the next iPhone app release. Your current membership is unchanged."); return deps.native; };
  const current = (scope: Pick<Scope, "owner" | "epoch">) => {
    if (!owner || owner !== scope.owner || epoch !== scope.epoch) throw Error("Your account changed. Sign in to the original account to restore the purchase.");
  };
  async function scope(): Promise<Scope> {
    const captured = { owner: owner ?? "", epoch };
    current(captured);
    if (deps.available && !deps.available()) throw Error("Return to HoopCheck and finish security verification first.");
    const session = await readWithDeadline(deps.session);
    current(captured);
    if (!session || session.id !== captured.owner || !session.token) throw Error("Sign in again to verify your membership.");
    return { ...captured, token: session.token };
  }
  async function sync(value: unknown, captured: Scope) {
    const item = transaction(value); current(captured);
    if (item.accountToken !== captured.owner) return false;
    const key = `${captured.epoch}:${captured.owner}:${item.id}`;
    const confirmed = acknowledged.get(key);
    if (confirmed?.signed === item.signedJWS && Date.now() - confirmed.at < 300000) return true;
    const existing = syncing.get(key); if (existing) return existing;
    const work = (async () => {
      const reply = record(await deps.request("/api/mobile/purchases/sync", captured.token, { signedTransaction: item.signedJWS }));
      current(captured);
      if (reply.owner !== captured.owner || reply.acknowledged !== true || reply.transactionId !== item.id) throw Error("Purchase synchronization could not be confirmed. Use Restore purchases to retry.");
      // A receipt stays unfinished after an uncertain response or account switch.
      // Never time out a native finish write: it can complete after a timeout.
      await bridge().finish(item.id);
      current(captured);
      if (acknowledged.size >= 100) acknowledged.clear();
      acknowledged.set(key, { signed: item.signedJWS, at: Date.now() });
      deps.onSynced(); return true;
    })();
    syncing.set(key, work);
    try { return await work; } finally { if (syncing.get(key) === work) syncing.delete(key); }
  }
  async function synchronize(values: unknown, captured: Scope) {
    if (!Array.isArray(values) || values.length > 100) throw Error("Apple purchases could not be read. Try restoring again.");
    let restored = 0, foreign = 0, failed = 0;
    for (const value of values) {
      current(captured);
      try { if (await sync(value, captured)) restored++; else foreign++; }
      catch (error) { current(captured); failed++; if (values.length === 1) throw error; break; }
    }
    return { restored, foreign, failed };
  }
  return {
    supported: Boolean(deps.native),
    setOwner(value: string | null) { if (owner !== value) { owner = value; epoch++; acknowledged.clear(); } },
    async membership(): Promise<EffectiveMembership | null> {
      const captured = await scope();
      const result = record(await deps.request("/api/membership", captured.token)); current(captured);
      if (result.owner !== captured.owner || !("subscription" in result)) throw Error("Membership could not be verified.");
      return parseEffectiveMembership(result.subscription);
    },
    async catalog() {
      const captured = await scope(), native = bridge();
      const result = record(await deps.request("/api/mobile/purchases/config", captured.token)); current(captured);
      if (result.owner !== captured.owner || !["Production", "Sandbox"].includes(String(result.environment)) || typeof result.canPurchase !== "boolean") throw Error("Membership options could not be verified.");
      if (!result.canPurchase) return { products: [] as StoreProduct[], canPurchase: false, reason: typeof result.reason === "string" ? result.reason.slice(0, 500) : "New purchases are unavailable for this account." };
      const products = storeProducts(await readWithDeadline(() => native.products(), 15000)); current(captured);
      if (products.length !== 6) throw Error("Some Apple membership products are unavailable. Please try again later.");
      return { products, canPurchase: true, reason: "" };
    },
    async prepare(product: StoreProduct): Promise<PreparedPurchase> {
      const captured = await scope(), native = bridge();
      storeProducts([product]);
      const identity = record(await readWithDeadline(() => native.identity(), 15000)); current(captured);
      if (!identifier(identity.id) || !jws(identity.signedJWS) || !["Production", "Sandbox"].includes(String(identity.environment))) throw Error("Apple app identity could not be verified.");
      const intent = record(await deps.request("/api/mobile/purchases/intent", captured.token, { productId: product.id, signedAppTransaction: identity.signedJWS })); current(captured);
      if (intent.owner !== captured.owner || intent.productId !== product.id || intent.appTransactionID !== identity.id || intent.environment !== identity.environment || typeof intent.allowIntroductoryOffer !== "boolean" || !["eligible", "ineligible", "unverified"].includes(String(intent.trialEligibility)) || (product.trialDays && !jws(intent.introductorySignature))) throw Error("Apple purchase preparation could not be verified.");
      return { product, owner: captured.owner, epoch: captured.epoch, appTransactionID: identity.id,
        environment: String(identity.environment), introductorySignature: typeof intent.introductorySignature === "string" ? intent.introductorySignature : "",
        hasTrial: product.trialDays === 7 && product.appleIntroEligible && intent.allowIntroductoryOffer && intent.trialEligibility === "eligible",
        trialEligibility: String(intent.trialEligibility), createdAt: Date.now() };
    },
    async purchase(prepared: PreparedPurchase) {
      const captured = await scope(); current(prepared);
      if (presenting) throw Error("An Apple subscription action is already in progress.");
      if (Date.now() - prepared.createdAt > 300000) throw Error("Membership options expired. Reload before purchasing.");
      presenting = true;
      try {
        // Purchase/restore sheets are user-initiated and intentionally not timed out.
        const result = record(await bridge().purchase(prepared.product.id, captured.owner, prepared.appTransactionID,
          prepared.introductorySignature, prepared.product.price, prepared.product.currency)); current(captured);
        if (result.state === "cancelled" || result.state === "pending") return result.state;
        if (result.state !== "purchased") throw Error("Apple did not confirm this purchase. Restore purchases to check again.");
        if (!await sync(result.transaction, captured)) throw Error("This purchase belongs to a different HoopCheck account.");
        return "purchased" as const;
      } finally { presenting = false; }
    },
    async scan() {
      if (!deps.native || !owner || deps.available && !deps.available()) return { restored: 0, foreign: 0, failed: 0 };
      const captured = await scope();
      const values = await readWithDeadline(() => bridge().transactions(), 15000); current(captured);
      return synchronize(values, captured);
    },
    async receive(value: unknown) {
      if (!owner || deps.available && !deps.available()) return false;
      return sync(value, await scope());
    },
    async restore() {
      const captured = await scope();
      if (presenting) throw Error("An Apple subscription action is already in progress.");
      presenting = true;
      try { const values = await bridge().restore(); current(captured); return await synchronize(values, captured); }
      finally { presenting = false; }
    },
    async manage() {
      await scope();
      if (presenting) throw Error("An Apple subscription action is already in progress.");
      presenting = true; try { await bridge().manage(); } finally { presenting = false; }
    },
  };
}
export function storeRequest(origin: string, request: typeof fetch = fetch): StoreRequest {
  let base: URL | null = null;
  try {
    const value = new URL(origin);
    if (value.protocol === "https:" && !value.username && !value.password && !value.search && !value.hash && value.pathname === "/") base = value;
  } catch { /* Invalid optional billing configuration must not block app startup. */ }
  return async (path, token, body) => {
    if (!base) throw Error("Membership service is unavailable.");
    if (!["/api/membership", "/api/mobile/purchases/config", "/api/mobile/purchases/intent", "/api/mobile/purchases/sync"].includes(path) || !token) throw Error("Invalid membership request.");
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await request(new URL(path, base).toString(), { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: controller.signal, cache: "no-store", redirect: "error" });
      const value = await response.json();
      if (!response.ok) throw Error(typeof value?.error === "string" ? value.error.slice(0, 500) : "Membership could not be verified. Please try again.");
      return value;
    } finally { clearTimeout(timer); }
  };
}
