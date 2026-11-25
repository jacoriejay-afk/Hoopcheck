import { evaluateProviderRights, type RightsGrant, type DataKind } from "./hoopdata-provider-rights";
import type { CompetitionTask } from "./hoopdata-competition-worker";
const policy:Record<CompetitionTask["kind"],{kind:DataKind;hours:number}>={seasons:{kind:"directory",hours:48},games:{kind:"fixtures",hours:24},standings:{kind:"standings",hours:1}};
/** Permission to evaluate alone is not permission to store a provider response.
 * Retention windows are explicit preview policy choices, not provider contract terms.
 */
export function authorizeCompetitionRefresh(task:CompetitionTask,plan:string,grants:readonly RightsGrant[],now:Date){
 const p=policy[task.kind];
 if(!p)return null;
 const base={provider:"api-sports" as const,competitionId:task.mapping.leagueId,kind:p.kind,plan};
 const evaluation=evaluateProviderRights({...base,use:"evaluate"},grants,now);
 const cache=evaluateProviderRights({...base,use:"cache",retentionHours:p.hours},grants,now);
 if(!evaluation.allowed||!cache.allowed)return null;
 const expiry=Math.min(Date.parse(cache.expiresAt),now.getTime()+p.hours*3600000);
 if(!Number.isFinite(expiry)||expiry<=now.getTime())return null;
 return {hours:p.hours,expiresAt:new Date(expiry).toISOString()};
}
