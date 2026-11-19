import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash, createPrivateKey, X509Certificate } from "node:crypto";
import { AppStoreServerAPIClient, Environment, SignedDataVerifier, IntroductoryOfferEligibilitySignatureCreator, Type, InAppOwnershipType, OfferDiscountType, OfferType, type JWSTransactionDecodedPayload, type JWSRenewalInfoDecodedPayload, type AppTransaction } from "@apple/app-store-server-library";
import { APPLE_APP_ID, APPLE_BUNDLE_ID, appleProduct } from "../../billing/apple-products";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const identifier = /^[0-9]{1,64}$/;
const productionDatabase = "ucbdceaieyenljcwlhnj.supabase.co";
export class AppleBillingError extends Error {
  constructor(public code: string, public status: number, message: string) { super(message); }
}
export function appleConfiguration(env: NodeJS.ProcessEnv = process.env) {
  if (env.APPLE_IAP_ENABLED !== "true") throw new AppleBillingError("apple_unavailable", 503, "Apple membership is not available yet. Existing memberships are unchanged.");
  const environment = env.APPLE_IAP_ENVIRONMENT;
  if (environment !== Environment.PRODUCTION && environment !== Environment.SANDBOX) throw new AppleBillingError("apple_configuration",503,"Apple membership needs attention. Try again later.");
  const database = new URL(env.NEXT_PUBLIC_SUPABASE_URL || "https://invalid.test").hostname;
  if (environment === Environment.SANDBOX && (env.VERCEL_ENV === "production" || database === productionDatabase)) throw new AppleBillingError("apple_environment",503,"Sandbox billing requires an isolated environment.");
  const keyID = env.APPLE_IAP_KEY_ID || "", issuerID = env.APPLE_IAP_ISSUER_ID || "", key = env.APPLE_IAP_PRIVATE_KEY?.replace(/\\n/g,"\n") || "";
  if (!/^[A-Z0-9]{10}$/.test(keyID) || !uuid.test(issuerID) || key.length > 8192) throw new AppleBillingError("apple_configuration",503,"Apple membership needs attention. Try again later.");
  try { const parsed=createPrivateKey(key); if(parsed.asymmetricKeyType!=="ec" || parsed.asymmetricKeyDetails?.namedCurve!=="prime256v1") throw Error(); }
  catch { throw new AppleBillingError("apple_configuration",503,"Apple membership needs attention. Try again later."); }
  return { environment, keyID, issuerID, key };
}
const roots = {
  "AppleIncRootCertificate.cer":"b0b1730ecbc7ff4505142c49f1295e6eda6bcaed7e2c68c5be91b5a11001f024",
  "AppleRootCA-G2.cer":"c2b9b042dd57830e7d117dac55ac8ae19407d38e41d88f3215bc3a890444a050",
  "AppleRootCA-G3.cer":"63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179",
};
export function appleTrustRoots() {
  return Object.entries(roots).map(([name, fingerprint]) => {
    const der=readFileSync(join(process.cwd(),"lib/server/apple/certs",name)); const certificate=new X509Certificate(der);
    if(createHash("sha256").update(der).digest("hex")!==fingerprint || !certificate.ca || !certificate.verify(certificate.publicKey) || Date.parse(certificate.validTo)<=Date.now()) throw new AppleBillingError("apple_trust",503,"Apple membership verification is unavailable.");
    return der;
  });
}
export function signedAppleValue(value: unknown): string {
  if(typeof value!=="string" || value.length<100 || value.length>32768 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(value)) throw new AppleBillingError("apple_proof",400,"Apple purchase verification is missing or invalid.");
  return value;
}
async function readDeadline<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try { return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new AppleBillingError("apple_timeout",503,"Apple did not finish verification. Your purchase can be restored or retried.")),20000);})]); }
  finally { clearTimeout(timer!); }
}
export function checkedAppIdentity(value: AppTransaction, environment: Environment) {
  if(value.bundleId!==APPLE_BUNDLE_ID || (environment===Environment.PRODUCTION && value.appAppleId!==APPLE_APP_ID) || value.receiptType!==environment || !identifier.test(value.appTransactionId??"") || !Number.isSafeInteger(value.receiptCreationDate) || value.receiptCreationDate!<=0 || value.receiptCreationDate!>Date.now()+300000) throw new AppleBillingError("apple_identity",403,"Apple app identity could not be verified.");
  return { id:value.appTransactionId!, environment };
}
export function checkedTransaction(value: JWSTransactionDecodedPayload, environment: Environment, owner?: string) {
  const product=appleProduct(value.productId);
  if(!product || value.bundleId!==APPLE_BUNDLE_ID || value.environment!==environment || value.type!==Type.AUTO_RENEWABLE_SUBSCRIPTION || value.inAppOwnershipType!==InAppOwnershipType.PURCHASED || !identifier.test(value.transactionId??"") || !identifier.test(value.originalTransactionId??"") || !uuid.test(value.appAccountToken??"") || (owner && value.appAccountToken!.toLowerCase()!==owner.toLowerCase())) throw new AppleBillingError("apple_ownership",403,"This Apple purchase could not be matched to your HoopCheck account.");
  for(const date of [value.purchaseDate,value.expiresDate,value.signedDate]) if(typeof date!=="number" || !Number.isSafeInteger(date) || date<=0) throw new AppleBillingError("apple_dates",400,"Apple purchase dates could not be verified.");
  if(value.purchaseDate!>Date.now()+300000 || value.signedDate!>Date.now()+300000 || value.expiresDate!<=value.purchaseDate!) throw new AppleBillingError("apple_dates",400,"Apple purchase dates could not be verified.");
  if(value.price!==undefined && (!Number.isSafeInteger(value.price) || value.price<0)) throw new AppleBillingError("apple_price",400,"Apple purchase terms could not be verified.");
  if(value.currency!==undefined && !/^[A-Z]{3}$/.test(value.currency)) throw new AppleBillingError("apple_price",400,"Apple purchase terms could not be verified.");
  // Sandbox renewal/trial clocks are accelerated per tester. The signed dates
  // still bound actual access; exact seven-day product metadata is checked on
  // device. Production receipts must retain the real seven-day trial.
  const trialDuration=value.expiresDate!-value.purchaseDate!;
  const validTrialDuration=environment===Environment.SANDBOX
    ? trialDuration>0 && trialDuration<=605100000
    : Math.abs(trialDuration-604800000)<=300000;
  if(value.offerDiscountType===OfferDiscountType.FREE_TRIAL && (value.offerType!==OfferType.INTRODUCTORY_OFFER || product.trialDays!==7 || value.price!==0 || !validTrialDuration)) throw new AppleBillingError("apple_trial",400,"Apple trial terms do not match this membership.");
  return value as JWSTransactionDecodedPayload & {transactionId:string;originalTransactionId:string;appAccountToken:string;productId:string;purchaseDate:number;expiresDate:number;signedDate:number};
}
export function appleServices(config=appleConfiguration()) {
  const verifier=new SignedDataVerifier(appleTrustRoots(),true,config.environment,APPLE_BUNDLE_ID,APPLE_APP_ID);
  const client=new AppStoreServerAPIClient(config.key,config.keyID,config.issuerID,APPLE_BUNDLE_ID,config.environment);
  const signer=new IntroductoryOfferEligibilitySignatureCreator(config.key,config.keyID,config.issuerID,APPLE_BUNDLE_ID);
  return {
    environment:config.environment,
    verifyApp:async(signed:unknown)=>checkedAppIdentity(await readDeadline(verifier.verifyAndDecodeAppTransaction(signedAppleValue(signed))),config.environment),
    verifyTransaction:async(signed:unknown,owner?:string)=>checkedTransaction(await readDeadline(verifier.verifyAndDecodeTransaction(signedAppleValue(signed))),config.environment,owner),
    verifyNotification:async(signed:unknown)=>readDeadline(verifier.verifyAndDecodeNotification(signedAppleValue(signed))),
    introductorySignature:(product:string,allow:boolean,identity:string)=>signer.createSignature(product,allow,identity),
    currentStatus:async(original:string,owner:string)=>{
      const response=await readDeadline(client.getAllSubscriptionStatuses(original));
      if(response.environment!==config.environment || response.bundleId!==APPLE_BUNDLE_ID || (config.environment===Environment.PRODUCTION && response.appAppleId!==APPLE_APP_ID)) throw new AppleBillingError("apple_status",503,"Apple membership status could not be verified.");
      const groups=response.data??[];
      if(groups.length>20 || groups.some(group=>(group.lastTransactions?.length??0)>100)) throw new AppleBillingError("apple_status",503,"Apple membership status could not be verified.");
      const matches=groups.flatMap(group=>group.lastTransactions??[]).filter(item=>item.originalTransactionId===original);
      if(matches.length!==1 || !matches[0].signedTransactionInfo || !matches[0].signedRenewalInfo || ![1,2,3,4,5].includes(matches[0].status??0)) throw new AppleBillingError("apple_status",503,"Apple membership status could not be verified.");
      const item=matches[0];
      const [transaction,renewal]=await Promise.all([
        readDeadline(verifier.verifyAndDecodeTransaction(item.signedTransactionInfo!)),
        readDeadline(verifier.verifyAndDecodeRenewalInfo(item.signedRenewalInfo!)),
      ]);
      const current=checkedTransaction(transaction,config.environment,owner);
      checkRenewal(renewal,current.originalTransactionId,config.environment);
      return {...current,status:item.status!,autoRenewStatus:renewal.autoRenewStatus,gracePeriodExpiresDate:renewal.gracePeriodExpiresDate,signedDate:Math.max(current.signedDate,renewal.signedDate!)};
    },
  };
}
function checkRenewal(renewal:JWSRenewalInfoDecodedPayload,original:string,environment:Environment) {
  if(renewal.originalTransactionId!==original || renewal.environment!==environment || ![0,1].includes(renewal.autoRenewStatus??-1) || typeof renewal.signedDate!=="number" || renewal.signedDate>Date.now()+300000 || (renewal.gracePeriodExpiresDate!==undefined && !Number.isSafeInteger(renewal.gracePeriodExpiresDate))) throw new AppleBillingError("apple_renewal",503,"Apple renewal status could not be verified.");
}
export type AppleServices=ReturnType<typeof appleServices>;
