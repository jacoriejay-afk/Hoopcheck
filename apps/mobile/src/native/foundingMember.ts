/** Private badge lookup. Never treats a locally supplied timestamp as eligibility. */
export async function readFoundingMember(url:string,token:string,signal:AbortSignal,request:typeof fetch=fetch){
 if(!token)return false;
 const response=await request(url,{headers:{Authorization:"Bearer "+token},cache:"no-store",redirect:"error",signal});
 if(!response.ok)return false;
 const value:unknown=await response.json();
 return !!value&&typeof value==="object"&&"eligible" in value&&value.eligible===true;
}
