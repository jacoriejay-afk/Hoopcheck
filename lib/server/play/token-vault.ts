import "server-only";
import {createCipheriv,createDecipheriv,createHmac,randomBytes,timingSafeEqual} from "node:crypto";
import {PLAY_PACKAGE} from "../../billing/play-products";
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const tokenPattern=/^[A-Za-z0-9._~-]{16,4096}$/;
const hex=/^[a-f0-9]{64}$/;
const invalid=()=>new Error("Google Play purchase credential is unavailable.");
type Scope="test"|"production";
export type SealedPurchase={version:1;fingerprint:string;envelope:string};
function key(value:string){if(typeof value!=="string"||!hex.test(value))throw invalid();return Buffer.from(value,"hex");}
function ownerId(value:string){if(typeof value!=="string"||!uuid.test(value))throw invalid();return value.toLowerCase();}
function scopeId(scope:Scope){if(scope!=="test"&&scope!=="production")throw invalid();return scope;}
function checkedToken(token:string){if(typeof token!=="string"||!tokenPattern.test(token))throw invalid();return token;}
function decode(value:string){if(!/^[A-Za-z0-9_-]+$/.test(value))throw invalid();const data=Buffer.from(value,"base64url");if(data.toString("base64url")!==value)throw invalid();return data;}
function associated(owner:string,scope:Scope,fingerprint:string){return Buffer.from(JSON.stringify(["hoopcheck-play-v1",PLAY_PACKAGE,scopeId(scope),ownerId(owner),fingerprint]));}
/** Stable keyed fingerprint independent of owner: a unique DB constraint must
 * prevent a purchase token being claimed by two accounts. Different test/live
 * namespaces and independent keys are mandatory. No database access here. */
export function createPlayTokenVault(encryptionKey:string,indexKey:string){
 const enc=key(encryptionKey),idx=key(indexKey);if(timingSafeEqual(enc,idx))throw invalid();
 const fingerprint=(token:string,scope:Scope)=>createHmac("sha256",idx).update(JSON.stringify(["hoopcheck-play-index-v1",PLAY_PACKAGE,scopeId(scope),checkedToken(token)])).digest("hex");
 return {
  fingerprint,
  seal(token:string,owner:string,scope:Scope):SealedPurchase{
   try{
    const digest=fingerprint(token,scope),iv=randomBytes(12);
    const cipher=createCipheriv("aes-256-gcm",enc,iv);
    cipher.setAAD(associated(owner,scope,digest));
    const data=Buffer.concat([cipher.update(token,"utf8"),cipher.final()]);
    return {version:1,fingerprint:digest,envelope:["v1",iv.toString("base64url"),cipher.getAuthTag().toString("base64url"),data.toString("base64url")].join(".")};
   }catch{throw invalid();}
  },
  open(record:SealedPurchase,owner:string,scope:Scope):string{
   try{
    if(!record||record.version!==1||typeof record.fingerprint!=="string"||!hex.test(record.fingerprint)||typeof record.envelope!=="string"||record.envelope.length>5600)throw invalid();
    const parts=record.envelope.split(".");if(parts.length!==4||parts[0]!=="v1")throw invalid();
    const iv=decode(parts[1]),tag=decode(parts[2]),data=decode(parts[3]);if(iv.length!==12||tag.length!==16||data.length<16||data.length>4096)throw invalid();
    const cipher=createDecipheriv("aes-256-gcm",enc,iv);cipher.setAAD(associated(owner,scope,record.fingerprint));cipher.setAuthTag(tag);
    const token=checkedToken(new TextDecoder("utf-8",{fatal:true}).decode(Buffer.concat([cipher.update(data),cipher.final()])));
    if(!timingSafeEqual(Buffer.from(fingerprint(token,scope),"hex"),Buffer.from(record.fingerprint,"hex")))throw invalid();
    return token;
   }catch{throw invalid();}
  }
 };
}
