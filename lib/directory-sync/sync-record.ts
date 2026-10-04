export type SyncRecord = { externalId?: string|null; name:string; country?:string|null; city?:string|null; level?:string|null; season?:string|null; leagueExternalId?:string|null; leagueName?:string|null; teamExternalId?:string|null; teamName?:string|null; role?:string|null; startDate?:string|null; endDate?:string|null };
export function clean(value?: string|null){ const v=value?.trim(); return v||null; }
export function normalizedKey(name:string,country?:string|null){ return `${name.trim().toLowerCase()}::${clean(country)?.toLowerCase()??""}`; }
