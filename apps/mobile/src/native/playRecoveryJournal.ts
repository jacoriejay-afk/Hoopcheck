// The encrypted journal stores only account scope and the non-secret exact
// consumed intent identifier. Never persist bearer, purchase or offer tokens.
type IntentMarker={intentId:string;productId:string};
export type PlayRecoveryMarker={version:1;owner:string;accountId:string;environment:"test";intentId?:string;productId?:string};
type Storage={read():Promise<string|null>;write(value:string):Promise<void>;remove():Promise<void>};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const hex=/^[a-f0-9]{64}$/;
function parse(raw:string):PlayRecoveryMarker{
 const v:unknown=JSON.parse(raw);
 if(!v||typeof v!=="object"||Array.isArray(v))throw Error("Recovery unavailable");
 const x=v as Record<string,unknown>,keys=Object.keys(x).sort().join(",");
 if(!["accountId,environment,owner,version","accountId,environment,intentId,owner,productId,version"].includes(keys)||x.version!==1||x.environment!=="test"||typeof x.owner!=="string"||!uuid.test(x.owner)||typeof x.accountId!=="string"||!hex.test(x.accountId))throw Error("Recovery unavailable");
 const marker:PlayRecoveryMarker={version:1,owner:x.owner,accountId:x.accountId,environment:"test"};
 if(keys.includes("intentId")){
  if(typeof x.intentId!=="string"||!uuid.test(x.intentId)||typeof x.productId!=="string"||!["hoopcheck.pro","hoopcheck.premium"].includes(x.productId))throw Error("Recovery unavailable");
  marker.intentId=x.intentId;marker.productId=x.productId;
 }
 return marker;
}
export function createPlayRecoveryJournal(storage:Storage){
 let tail:Promise<unknown>=Promise.resolve();
 const serial=<T,>(fn:()=>Promise<T>):Promise<T>=>{const next=tail.then(fn,fn);tail=next.catch(()=>undefined);return next;};
 const read=async()=>{const raw=await storage.read();return raw===null?null:parse(raw);};
 return {
  read:()=>serial(read),
  mark:(owner:string,accountId:string,intent?:IntentMarker)=>serial(async()=>{
   const marker=parse(JSON.stringify({version:1,owner,accountId,environment:"test",...intent}));
   const existing=await read();
   if(existing&&(existing.owner!==owner||existing.accountId!==accountId))return false;
   if(existing?.intentId){
    if(intent&&existing.intentId!==intent.intentId)return false;
    return true;
   }
   if(existing&&intent)return false;
   await storage.write(JSON.stringify(marker));
   const stored=await read();return stored?.owner===owner&&stored.accountId===accountId&&stored.intentId===marker.intentId;
  }),
  clear:(owner:string,accountId:string)=>serial(async()=>{
   const existing=await read();if(!existing)return true;
   if(existing.owner!==owner||existing.accountId!==accountId)return false;
   await storage.remove();return await read()===null;
  })
 };
}
