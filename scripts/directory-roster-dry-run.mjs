// Private dry-run only. Input must be a complete trusted canonical directory export,
 // not a paginated public search result. Never use this report as an import approval.
const key = v => typeof v === 'string' ? v.normalize('NFC').trim().toLowerCase().replace(/\s+/gu,' ') : '';
export function reviewRoster(competition, directory, {complete = false} = {}) {
  if (!complete || !Array.isArray(directory) || !['mens','womens'].includes(competition.side)
      || !Array.isArray(competition.teams)) throw new Error('Complete canonical export and explicit competition side required');
  const ids = new Set();
  for (const row of directory) {
    if (typeof row.id !== 'string' || !row.id || ids.has(row.id)) throw new Error('Invalid canonical export IDs');
    ids.add(row.id);
  }
  const seen = new Set();
  const rows = competition.teams.map(t => {
    const name=key(t.name), country=key(t.country);
    if (!name || !country || !Array.isArray(t.historicalNames)) throw new Error('Invalid review identity');
    const identity=JSON.stringify([competition.side,country,name]);
    if(seen.has(identity)) throw new Error('Repeated roster identity');
    seen.add(identity);
    const names=new Set([name,...t.historicalNames.map(key).filter(Boolean)]);
    // Include inactive and unknown-side records. They require review, not creation.
    // Do not use substring, phonetic, or parent-club name matching.
    const candidates=directory.filter(r=>key(r.country)===country && names.has(key(r.name))
      && (r.basketball_type===competition.side || !['mens','womens'].includes(r.basketball_type)));
    const matches=candidates.map(r=>({id:r.id,name:r.name,active:r.active===true,side:r.basketball_type}));
    let status='missing-exact-candidate';
    if(candidates.length>1) status='ambiguous';
    else if(candidates.length===1){
      const r=candidates[0];
      status=r.basketball_type!==competition.side?'unknown-side':key(r.name)!==name?'historical-alias-review':r.active!==true?'inactive-review':'exact-name-review';
    }
    return {name:t.name,country:t.country,status,matches,writeAuthorized:false};
  });
  // Same candidate attached to two roster entries is ambiguous even if names differ.
  const uses=new Map();
  for (const r of rows) for (const m of r.matches) uses.set(m.id,(uses.get(m.id)||0)+1);
  for (const r of rows) if(r.matches.some(m=>uses.get(m.id)>1)) r.status='ambiguous';
  return {competition:competition.competition,season:competition.season,expectedCount:competition.expectedCount,
    reviewedCount:rows.length,coverageCertified:false,writeAuthorized:false,rows};
}
