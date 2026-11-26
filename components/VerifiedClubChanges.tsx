import {verifiedClubChanges,type VerifiedClubClaim} from "../apps/mobile/src/native/verifiedClubChanges";
export default function VerifiedClubChanges({claims,partial}:{claims:VerifiedClubClaim[];partial:boolean}){
 if(process.env.NEXT_PUBLIC_HOOPCHECK_CLUB_CHANGES_ENABLED!=="true")return null;
 const report=verifiedClubChanges(claims,partial);
 return <section aria-label="Private club changes"><h2>Verified club chronology</h2><p>Only your separately verified, dated career records are compared. These are changes between recorded affiliations, not official transfer announcements or confirmed signing dates. Unverified and private details are not published.</p>{report.state==="unavailable"?<p>Chronology unavailable: verified dates, club identity, or complete records are missing or overlap.</p>:report.changes.length?<ul>{report.changes.map(change=><li key={change.id}><strong>{change.from} → {change.to}</strong><p>{change.lastRecordedEnd} (recorded end) · {change.nextRecordedStart} (recorded start)</p></li>)}</ul>:<p>No dated change between verified club records is available.</p>}</section>;
}
