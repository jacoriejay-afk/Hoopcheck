import "server-only";
import {createHmac,createPrivateKey,sign} from "node:crypto";
import {PLAY_PACKAGE,PLAY_PRODUCTS} from "../../billing/play-products";
import {classifyPlaySubscription,classifyPlayRuntimeSubscription,playLifecycle} from "../../billing/play-subscription";

const TOKEN_URL="https://oauth2.googleapis.com/token";
const API_ORIGIN="https://androidpublisher.googleapis.com";
const SCOPE="https://www.googleapis.com/auth/androidpublisher";
const MAX_BODY=256*1024;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
type Requester=typeof fetch;
type Env=Record<string,string|undefined>;
const unavailable=()=>new Error("Google Play verification is unavailable.");
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);

/** Derive a stable pseudonymous ID from an authenticated server-side owner.
 * Caller must verify session, MFA, role and deletion state before using it.
 * Do not expose the HMAC key, raw user UUID or purchase token to Google together. */
export function playAccountId(owner:string,keyHex:string):string {
 if(!uuid.test(owner)||! /^[a-f0-9]{64}$/i.test(keyHex))throw unavailable();
 return createHmac("sha256",Buffer.from(keyHex,"hex")).update("hoopcheck:play:account:v1:"+owner.toLowerCase()).digest("hex");
}
export function validPlaySandbox(env:Env){
 if(env.HOOPCHECK_PLAY_VERIFICATION_ENABLED!=="true"||env.HOOPCHECK_PLAY_ENVIRONMENT!=="test"||
 env.VERCEL_ENV==="production"||!env.NEXT_PUBLIC_SUPABASE_URL||!env.HOOPCHECK_PLAY_ISOLATED_SUPABASE_URL)return false;
 try{
  const actual=new URL(env.NEXT_PUBLIC_SUPABASE_URL),allowed=new URL(env.HOOPCHECK_PLAY_ISOLATED_SUPABASE_URL);
  return actual.protocol==="https:"&&actual.href===allowed.href&&actual.pathname==="/"&&!actual.username&&!actual.password&&!actual.search&&!actual.hash&&
   /^[a-z0-9]+\.supabase\.co$/.test(actual.hostname)&&actual.hostname!=="ucbdceaieyenljcwlhnj.supabase.co";
 }catch{return false;}
}
async function readJson(request:Requester,url:string,init:RequestInit):Promise<unknown>{
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),10000);
 try{
  const response=await request(url,{...init,signal:controller.signal,redirect:"error",cache:"no-store"});
  if(!response.ok||response.redirected||!response.body||Number(response.headers.get("content-length"))>MAX_BODY)throw unavailable();
  const reader=response.body.getReader();let size=0;const chunks:Uint8Array[]=[];
  try{
   for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BODY){await reader.cancel();throw unavailable();}chunks.push(value);}
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes)) as unknown;
 }catch{throw unavailable();}finally{clearTimeout(timer);}
}
const b64=(v:object)=>Buffer.from(JSON.stringify(v)).toString("base64url");
/** Test-only, read-only server client. No public handler or production mode.
 * No provider response, URL, credentials or raw token is returned or logged. */
export function createPlayVerificationClient(env:Env=process.env,request:Requester=fetch,clock=Date.now){
 if(!validPlaySandbox(env))throw unavailable();
 const email=env.HOOPCHECK_PLAY_SERVICE_ACCOUNT_EMAIL;
 const pem=env.HOOPCHECK_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY;
 const keyHex=env.HOOPCHECK_PLAY_ACCOUNT_HMAC_KEY;
 if(!email||email.length>254||! /^[a-z0-9._-]+@[a-z0-9.-]+\.iam\.gserviceaccount\.com$/i.test(email)||!pem||pem.length>16000||!keyHex||! /^[a-f0-9]{64}$/i.test(keyHex))throw unavailable();
 let privateKey:ReturnType<typeof createPrivateKey>;
 try{privateKey=createPrivateKey(pem);if(privateKey.asymmetricKeyType!=="rsa"||(privateKey.asymmetricKeyDetails?.modulusLength??0)<2048)throw unavailable();}catch{throw unavailable();}
 const serviceEmail=email,accountKey=keyHex;
 async function accessToken(){
  try{
   const now=Math.floor(clock()/1000);
   if(!Number.isSafeInteger(now)||now<=0)throw unavailable();
   const input=b64({alg:"RS256",typ:"JWT"})+"."+b64({iss:serviceEmail,scope:SCOPE,aud:TOKEN_URL,iat:now,exp:now+300});
   const assertion=input+"."+sign("RSA-SHA256",Buffer.from(input),privateKey).toString("base64url");
   const result=await readJson(request,TOKEN_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion}).toString()});
   if(!object(result)||typeof result.access_token!=="string"||! /^[A-Za-z0-9._~+\/-]{1,8192}={0,2}$/.test(result.access_token)||typeof result.token_type!=="string"||result.token_type.toLowerCase()!=="bearer"||typeof result.expires_in!=="number"||!Number.isSafeInteger(result.expires_in)||result.expires_in<=0)throw unavailable();
   return result.access_token;
  }catch{throw unavailable();}
 }
 async function readSubscription(token:unknown){
  if(typeof token!=="string"||! /^[A-Za-z0-9._~-]{16,4096}$/.test(token)||token==="."||token==="..")throw unavailable();
  const auth=await accessToken();
  return readJson(request,API_ORIGIN+"/androidpublisher/v3/applications/"+PLAY_PACKAGE+"/purchases/subscriptionsv2/tokens/"+encodeURIComponent(token),{method:"GET",headers:{Authorization:"Bearer "+auth,Accept:"application/json"}});
 }
 return {
  async readRegionalCatalog(region:string){
   if(!validPlaySandbox(env)||! /^[A-Z]{2}$/.test(region))throw unavailable();
   const auth=await accessToken(),rows=[];
   const deadline=clock()+30000;
   for(const productId of ["hoopcheck.pro","hoopcheck.premium"]){
    const payload=await readJson(request,API_ORIGIN+"/androidpublisher/v3/applications/"+PLAY_PACKAGE+"/subscriptions/"+productId,{method:"GET",headers:{Authorization:"Bearer "+auth,Accept:"application/json"}});
    rows.push(...parsePlayRegionalCatalog(payload,productId,region,deadline));
   }
   if(!validPlaySandbox(env)||clock()>=deadline)throw unavailable();
   return rows;
  },
  accountId(owner:string){return playAccountId(owner,accountKey);},
  async verify(owner:string,token:unknown){return classifyPlaySubscription(await readSubscription(token),playAccountId(owner,accountKey),"test",clock());},
  async verifyRuntime(owner:string,token:string,fingerprint:(token:string)=>string){
   const payload=await readSubscription(token);
   const decision=classifyPlayRuntimeSubscription(payload,playAccountId(owner,accountKey),token,fingerprint,clock());
   return {...decision,lifecycle:playLifecycle(payload,decision)};
  }
 };
}

// The Publisher API provides regional full-price Money values. Device
// ProductDetails remains authoritative for the displayed price and offer;
// intent issuance requires an exact match with this independent evidence.
export function parsePlayRegionalCatalog(payload:unknown,productId:string,region:string,expiresAt:number){
 if(!object(payload)||payload.packageName!==PLAY_PACKAGE||payload.productId!==productId||!Array.isArray(payload.basePlans)||payload.basePlans.length>50||! /^[A-Z]{2}$/.test(region)||!Number.isSafeInteger(expiresAt))throw unavailable();
 const expected=PLAY_PRODUCTS.filter(p=>p.productId===productId);
 if(expected.length!==3)throw unavailable();
 return expected.map(p=>{
  const found=payload.basePlans as unknown[];
  const plans=found.filter(v=>object(v)&&v.basePlanId===p.basePlanId);
  const plan=plans[0];
  if(plans.length!==1||!object(plan)||plan.state!=="ACTIVE"||!object(plan.autoRenewingBasePlanType)||Object.hasOwn(plan,"prepaidBasePlanType")||Object.hasOwn(plan,"installmentsBasePlanType")||
   plan.autoRenewingBasePlanType.billingPeriodDuration!==({monthly:"P1M","six-month":"P6M",annual:"P1Y"}[p.basePlanId])||!Array.isArray(plan.regionalConfigs)||plan.regionalConfigs.length>300)throw unavailable();
  const configs=plan.regionalConfigs.filter(v=>object(v)&&v.regionCode===region),config=configs[0];
  if(configs.length!==1||!object(config)||config.newSubscriberAvailability!==true||!object(config.price))throw unavailable();
  const money=config.price,units=money.units??"0",nanos=money.nanos??0;
  if(typeof units!=="string"||! /^(0|[1-9][0-9]{0,9})$/.test(units)||typeof nanos!=="number"||!Number.isInteger(nanos)||nanos<0||nanos>=1000000000||nanos%1000!==0||typeof money.currencyCode!=="string"||! /^[A-Z]{3}$/.test(money.currencyCode))throw unavailable();
  const micros=BigInt(units)*BigInt(1000000)+BigInt(nanos/1000);
  if(micros<=BigInt(0)||micros>BigInt("9999999999999999")||(region==="US"&&(money.currencyCode!=="USD"||micros!==BigInt(p.usdMinor)*BigInt(10000))))throw unavailable();
  return {productId:p.productId,basePlanId:p.basePlanId,priceMicros:micros.toString(),currency:money.currencyCode,environment:"test" as const,expiresAt};
 });
}
