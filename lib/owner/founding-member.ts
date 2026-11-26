/** Cohort decision uses only verified Auth creation time and owner-configured UTC cutoff.
 * No client profile metadata, no entitlements, no public verification claim.
 */
const iso=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
function timestamp(value:unknown){
 if(typeof value!=="string"||!iso.test(value))return null;
 const ms=Date.parse(value);if(!Number.isFinite(ms))return null;
 const canonical=value.includes(".")?value:value.replace(/Z$/,".000Z");
 return new Date(ms).toISOString()===canonical?ms:null;
}
export function foundingMemberEligible({enabled,cutoff,createdAt,confirmed,now}:{enabled:boolean;cutoff:unknown;createdAt:unknown;confirmed:boolean;now:number}){
 const boundary=timestamp(cutoff);
 // Supabase Auth creation timestamps may be serialized with fractional microseconds or +00:00.
 const authValue=typeof createdAt==="string"?createdAt.replace(/\+00:00$/,"Z").replace(/\.(\d{3})\d+Z$/,".$1Z"):createdAt;
 const created=timestamp(authValue);
 return enabled&&confirmed&&Number.isFinite(now)&&boundary!==null&&created!==null&&boundary<=now&&created<=now&&created<boundary;
}
