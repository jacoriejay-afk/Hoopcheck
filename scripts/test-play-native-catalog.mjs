import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const load=(path,requires={})=>{const exports={};new Function("exports","require",ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,key=>{if(Object.hasOwn(requires,key))return requires[key];throw Error("Unexpected import");});return exports;};
const products=load("../lib/billing/play-products.ts");
const {parsePlayCatalog}=load("../lib/billing/play-catalog.ts",{"./play-products":products});
const fixture=()=>products.PLAY_PRODUCTS.map(p=>({productId:p.productId,basePlanId:p.basePlanId,billingPeriod:({1:"P1M",6:"P6M",12:"P1Y"})[p.months],displayPrice:"5,99 €",currency:"EUR",priceMicros:"5990000"}));
test("six verified localized base-plan quotes retained, without offer or purchase tokens",()=>{
 assert.deepEqual(parsePlayCatalog(fixture()),fixture());
});
test("missing, duplicate, malformed, zero-priced and unexpected product quotes rejected",()=>{
 for(const mutate of [v=>v.pop(),v=>v[1]=v[0],v=>v[0].productId="foreign",v=>v[0].billingPeriod="P1Y",v=>v[0].priceMicros="0",v=>v[0].currency="unknown",v=>v[0].offerToken="synthetic",v=>v[0].displayPrice=""]){const rows=fixture();mutate(rows);assert.throws(()=>parsePlayCatalog(rows),{message:"Google Play catalog is unavailable."});}
});
test("native candidate exposes read-only catalog; does not launch or acknowledge billing",()=>{
 const base="../apps/mobile/modules/hoopcheck-play-billing/";
 const kt=read(base+"android/src/main/java/expo/modules/hoopcheckplaybilling/HoopcheckPlayBillingModule.kt");
 assert.match(kt,/AsyncFunction\("queryCatalog"\)/);
 assert.doesNotMatch(kt,/launchBillingFlow\(|acknowledgePurchase\(|consumeAsync\(|purchaseToken/);
 assert.match(read(base+"android/build.gradle"),/billing:9\.1\.0/);
 assert.deepEqual(JSON.parse(read(base+"expo-module.config.json")).platforms,["android"]);
 assert.match(read("../apps/mobile/app/membership.tsx"),/android && __DEV__ && process.env.EXPO_PUBLIC_HOOPCHECK_PLAY_CATALOG_DIAGNOSTIC/);
});

test("internal purchase operations use reviewed current quotes and account-scoped restore without exposing a payment API",()=>{
 const base="../apps/mobile/modules/hoopcheck-play-billing/";
 const kt=read(base+"android/src/main/java/expo/modules/hoopcheckplaybilling/PlayPurchaseOperations.kt");
 assert.match(kt,/internal object PlayPurchaseOperations/);
 assert.match(kt,/launchBillingFlow\(activity, params\)/);
 assert.match(kt,/setObfuscatedAccountId\(quote.obfuscatedAccountId\)/);
 assert.match(kt,/phase.priceAmountMicros == quote.priceMicros/);
 assert.match(kt,/age > 60_000L/);
 assert.match(kt,/queryPurchasesAsync\(params\)/);
 assert.match(kt,/purchase.accountIdentifiers\?\.obfuscatedAccountId != accountId/);
 assert.match(kt,/Purchase.PurchaseState.PENDING/);
 assert.match(kt,/Purchase.PurchaseState.PURCHASED/);
 assert.doesNotMatch(kt,/acknowledgePurchase\(|consumeAsync\(|AsyncFunction\(/);
 assert.doesNotMatch(read(base+"index.ts"),/launch|restore|purchaseToken/);
 assert.doesNotMatch(read(base+"android/src/main/java/expo/modules/hoopcheckplaybilling/HoopcheckPlayBillingModule.kt"),/PlayPurchaseOperations/);
});

test("native replacement is explicit, fresh, same-account and independently held",()=>{
 const base="../apps/mobile/modules/hoopcheck-play-billing/android/src/main/java/expo/modules/hoopcheckplaybilling/";
 const operations=read(base+"PlayPurchaseOperations.kt"),module=read(base+"PlayBillingRuntimeModule.kt");
 assert.match(operations,/setSubscriptionProductReplacementParams/);assert.match(operations,/setOldPurchaseToken/);
 assert.match(operations,/ReplacementMode.CHARGE_FULL_PRICE/);assert.match(operations,/ReplacementMode.WITHOUT_PRORATION/);
 assert.match(module,/private val signedSandboxAccepted = false/);
 assert.match(module,/prior.acknowledged/);assert.match(module,/prior.token == value/);
 assert.match(module,/scan.pendingCount == 0 && scan.unmatchedCount == 0/);
 assert.doesNotMatch(module,/acknowledgePurchase\(|consumeAsync\(/);
});
