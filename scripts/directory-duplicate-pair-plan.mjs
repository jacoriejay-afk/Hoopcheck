// #1040: review-only duplicate pair planner. Never mutates a database.
import {createHash} from 'node:crypto';
const key=v=>typeof v==='string'?v.normalize('NFC').trim().toLowerCase().replace(/\s+/gu,' '):'';
const text=v=>typeof v==='string'&&v.trim().length>0;
const sides=new Set(['mens','womens']);
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const snapshotRow=r=>[r.id,r.name,r.country,r.city??null,r.basketball_type,r.source_id??null,r.external_id??null,r.active===true];
export const pairFingerprint=(keep,retire)=>digest([snapshotRow(keep),snapshotRow(retire)]);
export function planDuplicatePairs(directory,decisions,{complete=false}={}){
 if(!complete||!Array.isArray(directory)||!Array.isArray(decisions))throw Error('Complete trusted canonical snapshot and review decisions required');
 const rows=new Map();
 for(const r of directory){
  if(!text(r.id)||rows.has(r.id))throw Error('Invalid canonical IDs');
  rows.set(r.id,r);
 }
 const usage=new Map();
 for(const d of decisions)for(const id of [d.keepId,d.retireId])usage.set(id,(usage.get(id)||0)+1);
 const pairs=decisions.map(d=>{
  const a=rows.get(d.keepId),b=rows.get(d.retireId),reasons=[];
  if(!a||!b||d.keepId===d.retireId)reasons.push('invalid-pair');
  if(usage.get(d.keepId)>1||usage.get(d.retireId)>1)reasons.push('overlapping-pairs');
  if(a&&b){
   if(!sides.has(a.basketball_type)||a.basketball_type!==b.basketball_type)reasons.push('side-conflict');
   if(!key(a.country)||key(a.country)!==key(b.country))reasons.push('country-conflict');
   if(key(a.city)&&key(b.city)&&key(a.city)!==key(b.city))reasons.push('city-conflict');
   if(a.source_id&&a.source_id===b.source_id&&text(a.external_id)&&text(b.external_id)&&a.external_id!==b.external_id)reasons.push('provider-id-conflict');
   if(a.active!==true)reasons.push('inactive-survivor');
   if(d.snapshotFingerprint!==pairFingerprint(a,b))reasons.push('stale-review');
  }
  if(d.identityConfirmed!==true||d.distinctSquadExcluded!==true||!text(d.reviewerId)||!text(d.evidenceRef)||!text(d.survivorReason))reasons.push('identity-evidence-required');
  return {keepId:d.keepId,retireId:d.retireId,status:reasons.length?'blocked':'reference-review-required',reasons,
   nextSteps:reasons.length?[]:['inventory-current-fk-and-legacy-references','review-unique-key-collisions','review-womens-mirror-and-season-memberships','design-redirect-and-rollback','test-on-isolated-database'],
   writeAuthorized:false};
 });
 return {pairs,referenceReviewCount:pairs.filter(p=>p.status==='reference-review-required').length,writeAuthorized:false};
}
