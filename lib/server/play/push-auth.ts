import "server-only";
import {createPublicKey,verify,type JsonWebKey} from "node:crypto";
const invalid=()=>Error("Google Play push authentication failed.");
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
type Config={audience:string;email:string;subject:string};
const part=(value:string)=>{if(!/^[A-Za-z0-9_-]+$/.test(value))throw invalid();const b=Buffer.from(value,"base64url");if(b.toString("base64url")!==value)throw invalid();return b;};
const json=(value:string):Record<string,unknown>=>{const v:unknown=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(part(value)));if(!obj(v))throw invalid();return v;};
/** Server-only push verifier. No caller-supplied keys, URLs or audiences in
 * HTTP input. Config is pinned by the future isolated deployment. */
export async function authenticatePlayPush(authorization:unknown,config:Config,request:typeof fetch,now=Date.now()):Promise<void>{
 try{
  if(!config||typeof config.audience!=="string"||!config.audience||config.audience.length>512||
   !/^[a-z0-9._-]+@[a-z0-9.-]+\.iam\.gserviceaccount\.com$/.test(config.email)||! /^[0-9]{1,64}$/.test(config.subject)||
   !Number.isFinite(now)||typeof authorization!=="string"||authorization.length>16384||!authorization.startsWith("Bearer "))throw invalid();
  const parts=authorization.slice(7).split(".");
  if(parts.length!==3)throw invalid();
  const [h,p,s]=parts,header=json(h),claims=json(p),signature=part(s);
  if(header.alg!=="RS256"||typeof header.kid!=="string"||! /^[A-Za-z0-9_-]{1,128}$/.test(header.kid)||
   Object.hasOwn(header,"crit")||Object.hasOwn(header,"jku")||Object.hasOwn(header,"jwk")||Object.hasOwn(header,"x5u"))throw invalid();
  const secs=Math.floor(now/1000);
  if((claims.iss!=="https://accounts.google.com"&&claims.iss!=="accounts.google.com")||claims.aud!==config.audience||
   claims.email!==config.email||claims.email_verified!==true||claims.sub!==config.subject||
   typeof claims.iat!=="number"||!Number.isSafeInteger(claims.iat)||claims.iat>secs+60||claims.iat<secs-3660||
   typeof claims.exp!=="number"||!Number.isSafeInteger(claims.exp)||claims.exp<=secs||claims.exp<=claims.iat||claims.exp-claims.iat>3660||
   (Object.hasOwn(claims,"nbf")&&(typeof claims.nbf!=="number"||!Number.isSafeInteger(claims.nbf)||claims.nbf>secs)))throw invalid();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{
   const response=await request("https://www.googleapis.com/oauth2/v3/certs",{method:"GET",redirect:"error",cache:"no-store",signal:controller.signal});
   if(!response.ok||response.redirected||!response.body||Number(response.headers.get("content-length"))>65536)throw invalid();
   const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
   try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();throw invalid();}chunks.push(value);}}finally{reader.releaseLock();}
   const keys:unknown=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(Buffer.concat(chunks)));
   if(!obj(keys)||!Array.isArray(keys.keys)||keys.keys.length>32)throw invalid();
   const matching=keys.keys.filter(k=>obj(k)&&k.kid===header.kid&&k.kty==="RSA"&&k.alg==="RS256"&&k.use==="sig");
   if(matching.length!==1)throw invalid();
   const key=createPublicKey({key:matching[0] as JsonWebKey,format:"jwk"});
   if(key.asymmetricKeyType!=="rsa"||(key.asymmetricKeyDetails?.modulusLength??0)<2048||!verify("RSA-SHA256",Buffer.from(h+"."+p),key,signature))throw invalid();
  }finally{clearTimeout(timer);}
 }catch{throw invalid();}
}
