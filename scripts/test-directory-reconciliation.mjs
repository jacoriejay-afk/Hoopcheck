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

const {planDirectoryImport}=await import('./directory-import-preflight.mjs');
const japan=regional.competitions.filter(c=>c.region==='Japan');
assert.deepEqual(japan.map(c=>c.expectedCount),[26,25,4]);
assert.deepEqual(japan.map(c=>c.teams.length),[26,25,4]);
assert.equal(new Set(japan.flatMap(c=>c.teams.map(t=>t.name))).size,55);
const now=new Date('2026-11-25T12:00:00Z');
const source={id:'source',active:true,license_status:'approved',commercial_use_allowed:true,redistribution_allowed:true};
const attestation={name:'Laketown Squadron',country:'United States',competition:'NBA G League',season:'2026-27',side:'mens',sourceId:'source',reviewerId:'reviewer',evidenceRef:'review-1',currentParticipationVerified:true,directoryRightsVerified:true,reviewedAt:'2026-11-24T12:00:00Z',validUntil:'2026-12-01T12:00:00Z',identityDecision:'existing',canonicalId:'2'};
const blocked=planDirectoryImport(g,fixtures,{...source,active:false},[attestation],now);
assert.equal(blocked.rightsBlocked,31);
assert.equal(blocked.proposedCount,0);
const proposed=planDirectoryImport(g,fixtures,source,[attestation],now);
assert.equal(proposed.proposedCount,1);
assert.deepEqual(proposed.rows.find(r=>r.name==='Laketown Squadron').proposal,{kind:'propose-season-membership',canonicalId:'2'});
assert.equal(proposed.writeAuthorized,false);
for(const a of [{...attestation,canonicalId:'wrong'},{...attestation,validUntil:'2026-11-24T12:00:00Z'},{...attestation,side:'womens'},{...attestation,directoryRightsVerified:false}]){
 assert.equal(planDirectoryImport(g,fixtures,source,[a],now).proposedCount,0);
}
assert.equal(planDirectoryImport(g,fixtures,source,[attestation,attestation],now).proposedCount,0);
const exclusion={...g,teams:[{...g.teams.find(t=>t.name==='Laketown Squadron'),excludedFromActiveImport:true}]};
assert.equal(planDirectoryImport(exclusion,fixtures,source,[attestation],now).rows[0].reason,'excluded');
const impact=read('../supabase/audit-directory-reference-impact-20261125.sql').replace(/^\s*--.*$/gm,'');
assert.match(impact,/begin transaction isolation level repeatable read read only;/i);
assert.match(impact,/rollback;\s*$/i);
assert.doesNotMatch(impact,/\b(insert|update|delete|alter|drop|truncate|grant|revoke|commit)\b/i);
assert.equal((impact.match(/join candidates d on/g)||[]).length,22);
assert.match(impact,/actual except select \* from expected/);
console.log('PASS: import preflight denies unlicensed, stale, wrong-side and unreviewed identities; 22 reference checks');

for(const name of ['Super League Basketball',"Women's Super League Basketball"]){
 const comp=regional.competitions.find(c=>c.competition===name);
 assert.equal(comp.teams.length,10);
 assert.equal(new Set(comp.teams.map(t=>t.name)).size,10);
 assert.ok(comp.teams.every(t=>t.country==='United Kingdom' && t.canonicalId===null));
}
for(const [name,count,expected] of [['Bónus deild kvenna',9,10],['Bónus deild karla',8,12]]){
 const comp=regional.competitions.find(c=>c.competition===name);
 assert.equal(comp.teams.length,count);
 assert.equal(comp.expectedCount,expected);
 assert.ok(comp.teams.every(t=>t.canonicalId===null));
 assert.match(comp.scope,/not certified/);
}
console.log('PASS: 55 Japanese announced teams, 20 British fixture participants, partial Iceland review; no canonical IDs or publication rights assumed');
