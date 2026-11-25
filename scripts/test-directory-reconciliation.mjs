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

const {reviewRoster}=await import('./directory-roster-dry-run.mjs');
const regional=JSON.parse(read('./directory-regional-review-20261125.json'));
assert.equal(regional.rightsApproved,false);
assert.equal(regional.publicationApproved,false);
const g=regional.competitions.find(x=>x.competition==='NBA G League');
assert.equal(g.teams.length,31);
assert.equal(g.teams.filter(t=>t.country==='United States').length,29);
assert.equal(g.teams.find(t=>t.name==='Raptors 905').country,'Canada');
assert.equal(g.teams.find(t=>t.name==='Mexico City Capitanes').country,'Mexico');
const fixtures=[{id:'1',name:'South Bay Lakers',country:'United States',basketball_type:'mens',active:false},{id:'2',name:'Birmingham Squadron',country:'United States',basketball_type:'mens',active:true},{id:'3',name:'Austin Spurs',country:'United States',basketball_type:'womens',active:true},{id:'4',name:'Iowa Wolves',country:'United States',basketball_type:'mens',active:true},{id:'5',name:'Iowa Wolves',country:'United States',basketball_type:'mens',active:false}];
assert.throws(()=>reviewRoster(g,fixtures));
const audit=reviewRoster(g,fixtures,{complete:true});
const row=n=>audit.rows.find(r=>r.name===n);
assert.equal(row('Coachella Valley Lakers').status,'historical-alias-review');
assert.equal(row('Laketown Squadron').status,'historical-alias-review');
assert.equal(row('Austin Spurs').status,'missing-exact-candidate');
assert.equal(row('Iowa Wolves').status,'ambiguous');
assert.equal(audit.coverageCertified,false);
assert.ok(audit.rows.every(r=>r.writeAuthorized===false));
assert.throws(()=>reviewRoster(g,[...fixtures,fixtures[0]],{complete:true}));
assert.equal(regional.competitions.find(c=>c.competition==='1. deild kvenna').announcedSeniorFirstTeams,9);
console.log('PASS: regional source registry and non-writing roster reconciliation');
