// Shared durable-export API contract for native Privacy Center.
// The server authenticates the owner and never accepts an owner UUID.
export const durableExportEnabled=process.env.EXPO_PUBLIC_ACCOUNT_EXPORT_FULFILLMENT_ENABLED==="true";
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const states=["queued","ready","failed","cancelled","expired"] as const;
type State=typeof states[number];
export type ExportAction="request"|"status"|"cancel"|"download";
export type ExportJob={id:string;scope:"owned-records-v1";complete:false;state:State;row_count:number;expires_at:string|null};
type Page={id:string;scope:"owned-records-v1";complete:false;row_count:number;expires_at:string;rows:{ordinal:number;section:string;data:Record<string,unknown>}[];next_after:number|null};
export type ExportResult={kind:"job";value:ExportJob}|{kind:"page";value:Page};
function object(x:unknown):x is Record<string,unknown>{return !!x&&typeof x==="object"&&!Array.isArray(x);}
export function validateExportResponse(value:unknown,action:ExportAction,job:string,after:number,now=Date.now()):ExportResult{
 if(!object(value)||typeof value.id!=="string"||!uuid.test(value.id)||(action!=="request"&&value.id!==job)||value.scope!=="owned-records-v1"||value.complete!==false||typeof value.row_count!=="number"||!Number.isSafeInteger(value.row_count)||value.row_count<0||value.row_count>1000000)throw Error("Export response unavailable.");
 const common={id:value.id,scope:"owned-records-v1" as const,complete:false as const,row_count:value.row_count};
 if(action!=="download"){
  if(typeof value.state!=="string"||!states.includes(value.state as State)||!(value.expires_at===null||typeof value.expires_at==="string"&&Number.isFinite(Date.parse(value.expires_at))))throw Error("Export response unavailable.");
  return {kind:"job",value:{...common,state:value.state as State,expires_at:value.expires_at}};
 }
 if(typeof value.expires_at!=="string"||!Number.isFinite(Date.parse(value.expires_at))||Date.parse(value.expires_at)<=now||after>value.row_count||!Array.isArray(value.rows)||value.rows.length!==Math.min(50,value.row_count-after))throw Error("Export page unavailable.");
 const rows=value.rows.map((row,i)=>{
  if(!object(row)||row.ordinal!==after+i+1||typeof row.section!=="string"||!/^[a-z_]{1,64}$/.test(row.section)||!object(row.data))throw Error("Export page unavailable.");
  return {ordinal:after+i+1,section:row.section,data:row.data};
 });
 const next=after+rows.length<value.row_count?after+rows.length:null;
 if(value.next_after!==next)throw Error("Export page unavailable.");
 return {kind:"page",value:{...common,expires_at:value.expires_at,rows,next_after:next}};
}
export async function requestDurableExport(origin:string,token:string,action:ExportAction,job:string,after:number,signal:AbortSignal,request:typeof fetch=fetch):Promise<ExportResult>{
 const url=new URL(origin);
 if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||url.search||url.hash||!/^\S{1,16384}$/.test(token)||!["request","status","cancel","download"].includes(action)||!uuid.test(job)||!Number.isSafeInteger(after)||after<0||(action!=="download"&&after!==0)||signal.aborted)throw Error("Invalid export request.");
 url.pathname="/api/account/export-job";
 const response=await request(url.toString(),{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({action,job,after}),redirect:"error",cache:"no-store",signal});
 if(signal.aborted||!response.ok||(response.url&&response.url!==url.toString()))throw Error("Export unavailable.");
 const value:unknown=await response.json();
 if(signal.aborted)throw Error("Export unavailable.");
 return validateExportResponse(value,action,job,after);
}
