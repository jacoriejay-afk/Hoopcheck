import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewRoster} from './directory-roster-dry-run.mjs';
const manifest=JSON.parse(readFileSync(new URL('./directory-korea-oceania-review-20261126.json',import.meta.url),'utf8'));
assert.equal(manifest.rightsApproved,false);
assert.equal(manifest.publicationApproved,false);
assert.deepEqual(manifest.competitions.map(c=>[c.competition,c.side,c.expectedCount]),[['KBL','mens',10],['WKBL','womens',6],['WNBL','womens',9]]);
const all=manifest.competitions.flatMap(c=>c.teams);
assert.equal(all.length,25);
assert.ok(all.every(t=>t.canonicalId===null && t.historicalNames.length===0));
for(const c of manifest.competitions){
 assert.equal(c.teams.length,c.expectedCount);
 assert.equal(new Set(c.teams.map(t=>t.name)).size,c.expectedCount);
 assert.equal(c.season,'2026-27');
 assert.match(c.source,/^https:\/\//);
 const report=reviewRoster(c,[],{complete:true});
 assert.equal(report.coverageCertified,false);
 assert.ok(report.rows.every(r=>r.writeAuthorized===false));
}
assert.ok(manifest.competitions[2].teams.some(t=>t.name==='Tasmania Jewels'));
console.log('PASS: 25 Korea/Australia roster review candidates, no write authorization');
