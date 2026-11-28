import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const compile=name=>ts.transpileModule(readFileSync(new URL('../lib/directory-sync/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const helper={exports:{}};
new Function('exports',compile('sync-record'))(helper.exports);
const mod={exports:{}};
new Function('require','exports',compile('sync-directory'))(name=>{assert.equal(name,'./sync-record');return helper.exports},mod.exports);
const {syncNormalizedDirectory}=mod.exports;
const ambiguous={code:'PGRST116',message:'Multiple records'};
function fake(matches){
 const writes=[],lookups=[],payloads=[];
 const db={from(table){
  const filters=[];let max=Infinity;
  const q={select(){return q},eq(k,v){filters.push([k,v]);return q},ilike(k,v){filters.push([k,v]);return q},is(k,v){filters.push([k,v]);return q},limit(n){max=n;return q},async maybeSingle(){
    lookups.push({table,filters,max});
    const rows=matches(table,filters).slice(0,max);
    return rows.length>1?{data:null,error:ambiguous}:{data:rows[0]??null,error:null};
  },insert(payload){writes.push(['insert',table]);payloads.push({table,kind:'insert',payload});return q},update(payload){writes.push(['update',table]);payloads.push({table,kind:'update',payload});return q},upsert(payload,options){writes.push(['upsert',table]);payloads.push({table,kind:'upsert',payload,options});return q},async single(){return {data:{id:'one'},error:null}}};return q;
 }};
 return {db,writes,lookups,payloads};
}
const base={leagues:[],teams:[],coaches:[]};
for(const [entity,row] of [
 ['leagues',{name:'Same League',country:'Japan'}],
 ['teams',{name:'Same Club',country:'Japan',city:'Tokyo'}],
 ['coaches',{name:'Same Coach',country:'Japan'}],
 ['teams',{name:'Same Club',country:'Japan',externalId:'provider-id'}],
 ['leagues',{name:'Same League',country:'Japan',externalId:'provider-id'}],
 ['coaches',{name:'Same Coach',country:'Japan',externalId:'provider-id'}],
 ['teams',{name:'Same Club',country:'Japan',leagueExternalId:'same-league'}],
 ['coaches',{name:'Same Coach',country:'Japan',teamExternalId:'same-club'}]
]){
 const f=fake(()=>[{id:'one'},{id:'two'}]);
 await assert.rejects(syncNormalizedDirectory(f.db,'source',entity,{...base,[entity]:[row]}),e=>e===ambiguous);
 assert.equal(f.writes.length,0);
 assert.ok(f.lookups.every(q=>q.max===2));
}
for(const name of ['Club%','Club_','Club*','Club\\']){
 const f=fake(()=>[]);
 await assert.rejects(syncNormalizedDirectory(f.db,'source','teams',{...base,teams:[{name,country:'Japan'}]}),/manual review/);
 assert.equal(f.writes.length,0);
}
const f=fake(()=>[{id:'one'}]);
const result=await syncNormalizedDirectory(f.db,'source','teams',{...base,teams:[{name:'Unique Club',country:'Japan',externalId:'provider-id'}]});
assert.equal(result.updated,1);
assert.deepEqual(f.writes,[['update','teams'],['insert','directory_change_log']]);
console.log('PASS: ambiguous legacy directory lookups and wildcard names stop before writes; unique provider identity can update');

const oldClub={id:'club',league_id:'domestic',league_name:'Domestic League'};
const sparse=fake(table=>table==='teams'?[oldClub]:[]);
await syncNormalizedDirectory(sparse.db,'source','teams',{...base,teams:[{name:'Club',country:'Spain',externalId:'club-key'}]});
const sparseUpdate=sparse.payloads.find(row=>row.table==='teams');
assert.ok(!Object.hasOwn(sparseUpdate.payload,'league_id'));
assert.ok(!Object.hasOwn(sparseUpdate.payload,'league_name'));
assert.ok(!sparse.writes.some(([kind,table])=>table==='team_league_memberships'));
const multi=fake(table=>table==='teams'?[oldClub]:table==='leagues'?[{id:'continental'}]:[]);
await syncNormalizedDirectory(multi.db,'source','teams',{...base,teams:[{name:'Club',country:'Spain',externalId:'club-key',leagueExternalId:'continental-key',leagueName:'Continental League',season:'2026-27'}]});
assert.ok(!Object.hasOwn(multi.payloads.find(row=>row.table==='teams').payload,'league_id'));
const membership=multi.payloads.find(row=>row.table==='team_league_memberships');
assert.equal(membership.payload.league_id,'continental');
assert.equal(membership.payload.season,'2026-27');
assert.equal(membership.options.ignoreDuplicates,true);
assert.ok(multi.lookups.filter(q=>q.table==='leagues'||q.table==='teams').every(q=>q.filters.some(([k,v])=>k==='basketball_type'&&v==='mens')));
const missing=fake(()=>[]);
await assert.rejects(syncNormalizedDirectory(missing.db,'source','teams',{...base,teams:[{name:'New Club',country:'Spain',leagueExternalId:'unknown'}]}),/unresolved competition/);
assert.equal(missing.writes.length,0);
const undated=fake(table=>table==='teams'?[oldClub]:table==='leagues'?[{id:'continental'}]:[]);
await syncNormalizedDirectory(undated.db,'source','teams',{...base,teams:[{name:'Club',country:'Spain',externalId:'club-key',leagueExternalId:'continental-key'}]});
assert.ok(!undated.writes.some(([kind,table])=>table==='team_league_memberships'));
console.log('PASS: sparse provider records preserve primary links; secondary membership writes require season, preserve history and reject unresolved new teams');
