/** Existing private support queue intake; no direct directory edits or automatic URL retrieval. */
export const correctionKinds=["teams","womens","leagues","womens/leagues"] as const;
export type CorrectionKind=typeof correctionKinds[number];
export const correctionFields=["name","league","country","city","season","logo","schedule","other"] as const;
export type CorrectionField=typeof correctionFields[number];
export const correctionSubject="Basketball data correction";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function correctionTicket(input:{kind:CorrectionKind;entityId:string;field:CorrectionField;correction:string;source:string}){
  if(!correctionKinds.includes(input.kind)||!correctionFields.includes(input.field)||!uuid.test(input.entityId.trim()))return null;
  const correction=input.correction.trim(),source=input.source.trim();
  if(correction.length<10||correction.length>1000||source.length>500||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(correction+source))return null;
  // Optional public evidence URL is text only; never fetch it automatically.
  if(source){
    try{const url=new URL(source);if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||!url.hostname.includes(".")||/\s/.test(source))return null;}catch{return null;}
  }
  return {subject:correctionSubject,category:"team_request" as const,priority:"normal" as const,
    description:["Directory record: https://hoopcheck.online/"+input.kind+"/"+input.entityId.trim().toLowerCase(),"Field: "+input.field,"Proposed correction: "+correction,"Public evidence: "+(source||"Not supplied")].join("\n")};
}
