import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const manifest=JSON.parse(read('./directory-russia-roster-review-20261125.json'));
assert.equal(manifest.rightsApproved,false);
assert.equal(manifest.season,'2026-27');
assert.deepEqual(manifest.competitions.map(c=>c.teams.length),[14,8,12,11,7]);
assert.equal(manifest.competitions.flatMap(c=>c.teams).length,52);
const keys=new Set();
for(const c of manifest.competitions){
  for(const t of c.teams){
    assert.equal(t.canonicalId,null);
    assert.equal(t.currentParticipationVerified,false);
    assert.ok(['conditional','announced'].includes(t.admission));
    const key=JSON.stringify([c.side,c.competition,t.name.normalize('NFC').toLowerCase(),t.locality]);
    assert.ok(!keys.has(key));keys.add(key);
  }
}
assert.equal(manifest.competitions.flatMap(c=>c.teams).filter(t=>t.admission==='conditional').length,4);
const excluded=manifest.competitions.flatMap(c=>c.teams).filter(t=>t.excludedFromActiveImport===true);
assert.equal(excluded.length,1);
assert.equal(excluded[0].name,'Platov-RGEU');
assert.equal(excluded[0].exclusionDate,'2026-10-26');
assert.equal(excluded[0].currentParticipationVerified,false);
assert.ok(excluded[0].exclusionSource.startsWith('https://russiabasket.ru/'));
assert.equal(manifest.currentSeasonSourceReview.competitionSources.length,5);
const sql=read('../supabase/audit-directory-reconciliation-20261125.sql');
const executable=sql.replace(/^\s*--.*$/gm,'');
assert.match(executable,/begin transaction isolation level repeatable read read only;/i);
assert.match(executable,/rollback;\s*$/i);
assert.doesNotMatch(executable,/\b(insert|update|delete|alter|drop|truncate|grant|revoke|commit)\b/i);
assert.match(executable,/group by 1,2,3 having count\(\*\) > 1/);
assert.match(executable,/left join public\.teams t on t\.id=w\.id/);
assert.match(executable,/confrelid in \('public\.teams'::regclass,'public\.womens_teams'::regclass\)/);
console.log('PASS: 52 review-only candidates, conditional admissions, side-aware read-only audit');
