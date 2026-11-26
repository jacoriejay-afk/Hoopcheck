export const referenceActions=["read","request","accept","decline","revoke"] as const;
export type ReferenceAction=typeof referenceActions[number];
export type ReferenceState={state:"none"|"pending"|"accepted"|"declined"|"revoked"|"expired";canRequest:boolean;canRespond:boolean;canRevoke:boolean};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseReferenceAction(value:unknown):{connectionId:string;action:ReferenceAction}|null{
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const raw=value as Record<string,unknown>;
 if(Object.keys(raw).some(k=>k!=="connectionId"&&k!=="action")||typeof raw.connectionId!=="string"||!uuid.test(raw.connectionId)||!referenceActions.includes(raw.action as ReferenceAction))return null;
 return {connectionId:raw.connectionId,action:raw.action as ReferenceAction};
}
export function parseReferenceState(value:unknown):ReferenceState|null{
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const r=value as Record<string,unknown>;
 if(!["none","pending","accepted","declined","revoked","expired"].includes(String(r.state))||typeof r.canRequest!=="boolean"||typeof r.canRespond!=="boolean"||typeof r.canRevoke!=="boolean")return null;
 if(r.canRequest&&r.state!=="none"||r.canRespond&&r.state!=="pending"||r.canRevoke&&r.state!=="pending"&&r.state!=="accepted")return null;
 return {state:r.state as ReferenceState["state"],canRequest:r.canRequest,canRespond:r.canRespond,canRevoke:r.canRevoke};
}
export const referenceLabels:Record<ReferenceState["state"],string>={none:"No reference consent requested",pending:"Awaiting consent",accepted:"Agreed to discuss basketball experience",declined:"Declined",revoked:"Consent withdrawn",expired:"Request expired"};
export async function requestPlayerReference(url:string,token:string,connectionId:string,action:ReferenceAction,signal:AbortSignal,request:typeof fetch=fetch){
 const input=parseReferenceAction({connectionId,action});if(!input||!token)throw Error("Reference unavailable");
 const response=await request(url,{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(input),cache:"no-store",redirect:"error",signal});
 if(!response.ok)throw Error("Reference unavailable");
 const result=parseReferenceState(await response.json());if(!result)throw Error("Reference unavailable");
 return result;
}
