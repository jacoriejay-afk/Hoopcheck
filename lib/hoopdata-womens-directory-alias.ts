const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Alias={legacyLeagueId:string;canonicalLeagueId:string;status:"approved"|"pending"|"revoked";evidence:string;reviewedAt:string;validUntil:string};
/** Trusted operator-reviewed preview records only. No name matching or implied UUID equivalence. */
export function resolveWomensStandingsAlias(legacyLeagueId:string,records:readonly Alias[],now:Date){
 const matches=records.filter(r=>r.legacyLeagueId===legacyLeagueId);
 if(!uuid.test(legacyLeagueId)||matches.length!==1)return null;
 const r=matches[0],reviewed=Date.parse(r.reviewedAt),expiry=Date.parse(r.validUntil),at=now.getTime();
 if(r.status!=="approved"||!uuid.test(r.canonicalLeagueId)||typeof r.evidence!=="string"||!r.evidence.trim()||!Number.isFinite(at)||!Number.isFinite(reviewed)||!Number.isFinite(expiry)||reviewed>at||expiry<=at||records.filter(x=>x.canonicalLeagueId===r.canonicalLeagueId).length!==1)return null;
 return {canonicalLeagueId:r.canonicalLeagueId,expiresAt:new Date(expiry).toISOString()};
}
