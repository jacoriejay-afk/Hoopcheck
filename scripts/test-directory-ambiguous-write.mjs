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
 const writes=[],lookups=[];
 const db={from(table){
  const filters=[];let max=Infinity;
  const q={select(){return q},eq(k,v){filters.push([k,v]);return q},ilike(k,v){filters.push([k,v]);return q},is(k,v){filters.push([k,v]);return q},limit(n){max=n;return q},async maybeSingle(){
    lookups.push({table,filters,max});
    const rows=matches(table,filters).slice(0,max);
    return rows.length>1?{data:null,error:ambiguous}:{data:rows[0]??null,error:null};
  },insert(){writes.push(['insert',table]);return q},update(){writes.push(['update',table]);return q},upsert(){writes.push(['upsert',table]);return q},async single(){return {data:{id:'one'},error:null}}};return q;
 }};
 return {db,writes,lookups};
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
