// Offline preflight for already-reviewed rows. Never writes or authorizes publication.
import {reviewRoster} from './directory-roster-dry-run.mjs';
const nonempty=v=>typeof v==='string' && v.trim().length>0;
export function planDirectoryImport(competition, directory, source, attestations, now) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw Error('Explicit valid review time required');
  if (!Array.isArray(attestations)) throw Error('Trusted review attestations required');
  const report=reviewRoster(competition,directory,{complete:true});
  const validSource=source?.active===true && source.license_status==='approved'
    && source.commercial_use_allowed===true && source.redistribution_allowed===true
    && nonempty(source.id);
  const rows=report.rows.map(r=>{
    const a=attestations.filter(a=>a.name===r.name && a.country===r.country
      && a.competition===report.competition && a.season===report.season
      && a.side===competition.side && a.sourceId===source?.id);
    const x=a[0];
    const validAttestation=a.length===1 && nonempty(x.reviewerId) && nonempty(x.evidenceRef)
      && x.currentParticipationVerified===true && x.directoryRightsVerified===true
      && Number.isFinite(Date.parse(x.reviewedAt)) && Number.isFinite(Date.parse(x.validUntil))
      && Date.parse(x.reviewedAt)<=now.getTime() && Date.parse(x.validUntil)>now.getTime();
    const raw=competition.teams.find(t=>t.name===r.name && t.country===r.country);
    let reason='identity-review-required',proposal=null;
    if(raw?.excludedFromActiveImport===true)reason='excluded';
    else if(!validSource)reason='rights-blocked';
    else if(!validAttestation)reason='current-participation-or-rights-review-required';
    else if(r.status==='missing-exact-candidate' && x.identityDecision==='new' && x.canonicalId===null){
      reason='operator-review-required';proposal={kind:'propose-new',canonicalId:null};
    }else if(['exact-name-review','historical-alias-review','inactive-review'].includes(r.status)
      && x.identityDecision==='existing' && r.matches.length===1 && x.canonicalId===r.matches[0].id){
      reason='operator-review-required';proposal={kind:'propose-season-membership',canonicalId:x.canonicalId};
    }
    return {...r,reason,proposal,writeAuthorized:false};
  });
  return {...report,rows,rightsBlocked:rows.filter(r=>r.reason==='rights-blocked').length,
    proposedCount:rows.filter(r=>r.proposal!==null).length,writeAuthorized:false,coverageCertified:false};
}
