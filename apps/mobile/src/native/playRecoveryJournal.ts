// Persist only a test purchase interruption marker, never a bearer, purchase
// token, offer token, localized price, provider response, or membership grant.
export type PlayRecoveryMarker={version:1;owner:string;accountId:string;environment:"test"};
type Storage={read():Promise<string|null>;write(value:string):Promise<void>;remove():Promise<void>};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const hex=/^[a-f0-9]{64}$/;
function parse(raw:string):PlayRecoveryMarker{
 const v:unknown=JSON.parse(raw);
 if(!v||typeof v!=="object"||Array.isArray(v))throw Error("Recovery unavailable");
 const x=v as Record<string,unknown>;
 if(Object.keys(x).sort().join(",")!=="accountId,environment,owner,version"||x.version!==1||x.environment!=="test"||typeof x.owner!=="string"||!uuid.test(x.owner)||typeof x.accountId!=="string"||!hex.test(x.accountId))throw Error("Recovery unavailable");
 return {version:1,owner:x.owner,accountId:x.accountId,environment:"test"};
}
export function createPlayRecoveryJournal(storage:Storage){
 // Serialize operations within the app instance; one coordinator should own
 // the journal. Storage failures/corrupt records must block new launches.
 let tail:Promise<unknown>=Promise.resolve();
 const serial=<T,>(fn:()=>Promise<T>):Promise<T>=>{const next=tail.then(fn,fn);tail=next.catch(()=>undefined);return next;};
 const read=async()=>{const raw=await storage.read();return raw===null?null:parse(raw);};
 return {
  read:()=>serial(read),
  mark:(owner:string,accountId:string)=>serial(async()=>{
   const marker=parse(JSON.stringify({version:1,owner,accountId,environment:"test"}));
   const existing=await read();
   if(existing&&(existing.owner!==owner||existing.accountId!==accountId))return false;
   await storage.write(JSON.stringify(marker));
   const stored=await read();return stored?.owner===owner&&stored.accountId===accountId;
  }),
  clear:(owner:string,accountId:string)=>serial(async()=>{
   const existing=await read();if(!existing)return true;
   if(existing.owner!==owner||existing.accountId!==accountId)return false;
   await storage.remove();return await read()===null;
  })
 };
}
