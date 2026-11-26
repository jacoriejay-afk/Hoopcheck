import "server-only";
import { ambassadorDb } from "../ambassador/server";
const MAX_CAMPAIGNS=20;
export async function readCampaignReporting() {
 const db=ambassadorDb();
 const {data:campaigns,error}=await db.from("ambassador_campaigns").select("code,display_name").order("code").limit(MAX_CAMPAIGNS+1);
 if(error||!campaigns)return null;
 const shown=campaigns.slice(0,MAX_CAMPAIGNS);
 if(!shown.length)return {rows:[],limited:false};
 const grants=await db.from("ambassador_grants").select("id,code").in("code",shown.map(c=>c.code));
 if(grants.error||!grants.data)return null;
 const rows=[];
 for(const campaign of shown){
  const grant=grants.data.find(g=>g.code===campaign.code);
  if(!grant){rows.push({name:campaign.display_name,code:campaign.code,linked:false,clicks:null,attributed:null,qualified:null});continue;}
  const opt={head:true,count:"exact"} as const;
  const [clicks,attributed,qualified]=await Promise.all([
   db.from("ambassador_clicks").select("clicks").eq("ambassador_id",grant.id).maybeSingle(),
   db.from("ambassador_attributions").select("*",opt).eq("ambassador_id",grant.id).is("disqualified_at",null),
   db.from("ambassador_attributions").select("*",opt).eq("ambassador_id",grant.id).is("disqualified_at",null).not("first_paid_at","is",null)
  ]);
  const valid=(v:unknown)=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0?v:null;
  rows.push({name:campaign.display_name,code:campaign.code,linked:true,clicks:clicks.error?null:valid(clicks.data?.clicks??0),attributed:attributed.error?null:valid(attributed.count),qualified:qualified.error?null:valid(qualified.count)});
 }
 return {rows,limited:campaigns.length>MAX_CAMPAIGNS};
}
