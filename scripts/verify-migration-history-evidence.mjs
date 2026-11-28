// Offline evidence integrity only; never executes SQL or connects to a database.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const m=JSON.parse(readFileSync(new URL('../reports/migration-history/evidence-812bdca.json',import.meta.url),'utf8'));
const root=new URL('../supabase/migrations/',import.meta.url);
assert.equal(m.release_authorized,false);
assert.equal(m.history_repair_authorized,false);
assert.equal(m.rows.length,404);
const p=m.rows.filter(r=>r.side==='production'), r=m.rows.filter(r=>r.side==='repository');
assert.equal(p.length,221); assert.equal(r.length,183);
assert.equal(new Set(p.map(x=>x.version)).size,221);
assert.equal(new Set(r.map(x=>x.name)).size,183);
assert.equal(m.repository_files.length,218);
assert.equal(new Set(m.repository_files.map(x=>x.name)).size,218);
assert.equal(m.duplicate_groups.length,7);
const names=readdirSync(root).filter(x=>x.endsWith('.sql')).sort();
assert.deepEqual(names,m.repository_files.map(x=>x.name).sort());
const byName=new Map(m.repository_files.map(x=>[x.name,x.sha]));
for(const f of m.repository_files){
 const bytes=readFileSync(new URL(f.name,root));
 const hash=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 assert.equal(hash,f.sha,f.name);
}
for(const x of p){
 assert.match(x.statement_array_sha256,/^[a-f0-9]{64}$/);
 assert.ok(Number.isInteger(x.statement_count)&&x.statement_count>0);
 assert.ok(x.candidate_blob_sha1.every(h=>/^[a-f0-9]{40}$/.test(h)));
 const expected=m.repository_files.filter(f=>x.candidate_blob_sha1.includes(f.sha));
 assert.deepEqual(x.content_matches,expected);
}
const pVersions=new Set(p.map(x=>x.version));
assert.deepEqual(r.map(x=>x.name).sort(),names.filter(n=>!pVersions.has(n.split('_')[0])));
for(const g of m.duplicate_groups){assert.equal(g.files.length,2);for(const f of g.files){assert.equal(byName.get(f.name),f.sha);assert.ok(f.name.startsWith(g.version+'_'));}}
console.log('Evidence integrity verified; no replay or release authorization.');
