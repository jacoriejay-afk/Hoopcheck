/** New provider expansion policy. Pure gate; callers must use trusted reviewed records.
 * This file is not an authorization, legal opinion, or an active production switch.
 */
export const DATA_PROVIDERS=["api-sports","balldontlie","highlightly","thesportsdb","fiba-gdap","eurobasket","teamkeys","sportsdataverse","sportradar","goalserve","league-direct"] as const;
export type DataProvider=typeof DATA_PROVIDERS[number];
export type DataKind="fixtures"|"scores"|"standings"|"directory"|"player-stats"|"artwork";
export type DataUse="evaluate"|"cache"|"web-display"|"app-display"|"notifications";
export type RightsGrant={
 provider:DataProvider; competitionId:string; kind:DataKind;
 plan:string; evidenceRef:string; reviewerId:string; reviewedAt:string; validUntil:string;
 uses:readonly DataUse[]; status:"approved"|"revoked"|"pending";
 retentionHours:number; attribution:string; upstreamRightsConfirmed:boolean;
 artworkPermissionConfirmed:boolean; appStorePermissionConfirmed:boolean;
};
export type RightsRequest={provider:DataProvider;competitionId:string;kind:DataKind;use:DataUse;plan:string;retentionHours?:number};
const kinds=["fixtures","scores","standings","directory","player-stats","artwork"];
const uses=["evaluate","cache","web-display","app-display","notifications"];
const nonblank=(v:unknown):v is string=>typeof v==="string"&&v.trim().length>0;
export function evaluateProviderRights(request:RightsRequest,grants:readonly RightsGrant[],now:Date){
 const deny=(reason:string)=>({allowed:false as const,reason});
 const at=now.getTime();
 if(!Number.isFinite(at)||!DATA_PROVIDERS.includes(request.provider)||!kinds.includes(request.kind)||!uses.includes(request.use)||!nonblank(request.competitionId)||!nonblank(request.plan))return deny("invalid-request");
 const matching=grants.filter(g=>g.provider===request.provider&&g.competitionId===request.competitionId&&g.kind===request.kind&&g.plan===request.plan);
 if(matching.length!==1)return deny("missing-or-ambiguous-rights");
 const g=matching[0];
 if(g.status!=="approved"||!nonblank(g.evidenceRef)||!nonblank(g.reviewerId)||g.upstreamRightsConfirmed!==true||!Array.isArray(g.uses)||!g.uses.includes(request.use))return deny("not-authorized");
 const reviewed=Date.parse(g.reviewedAt),expiry=Date.parse(g.validUntil);
 if(!Number.isFinite(reviewed)||!Number.isFinite(expiry)||reviewed>at||expiry<=at||expiry<=reviewed)return deny("review-expired");
 if(request.kind==="artwork"&&g.artworkPermissionConfirmed!==true)return deny("artwork-rights-required");
 if(request.use==="app-display"&&g.appStorePermissionConfirmed!==true)return deny("app-store-rights-required");
 if(request.use==="cache"){
  const hours=request.retentionHours;
  if(typeof hours!=="number"||!Number.isFinite(hours)||hours<=0||!Number.isFinite(g.retentionHours)||hours>g.retentionHours||at+hours*3600000>expiry)return deny("retention-not-authorized");
 }
 return {allowed:true as const,attribution:typeof g.attribution==="string"?g.attribution:"",expiresAt:g.validUntil};
}
