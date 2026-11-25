import type { Metadata } from "next";
import Link from "next/link";
import { ambassadorDb, requireAmbassadorSession } from "../../../lib/ambassador/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {title:"Basketball Data Center | HoopCheck™",robots:{index:false,follow:false}};

export default async function BasketballDataCenter(){
  await requireAmbassadorSession("/owner-hq/basketball-data",true);
  const db=process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL ? ambassadorDb() : null;
  const now=new Date(), since=new Date(now.getTime()-25*60_000).toISOString(), upcoming=new Date(now.getTime()+7*86400_000).toISOString();
  const opt={head:true,count:"exact"} as const;
  async function count(query:PromiseLike<{count:number|null;error:unknown}>|undefined){
    try{const r=await query;return r&&!r.error&&r.count!==null?String(r.count):"Unavailable";}catch{return "Unavailable";}
  }
  async function latest(){
    try{const r=await db?.from("fan_live_games").select("score_updated_at").not("score_updated_at","is",null).order("score_updated_at",{ascending:false}).limit(1).maybeSingle();
      const stamp=r?.data?.score_updated_at;return !r?.error&&typeof stamp==="string"&&Number.isFinite(Date.parse(stamp))?new Date(stamp).toISOString():"Unavailable";
    }catch{return "Unavailable";}
  }
  const values=await Promise.all([
    count(db?.from("fan_live_games").select("id",opt).eq("provider_source","api-sports-basketball")),
    count(db?.from("fan_live_games").select("id",opt).eq("status","live")),
    count(db?.from("fan_live_games").select("id",opt).eq("status","live").lt("score_updated_at",since)),
    count(db?.from("fan_live_games").select("id",opt).eq("status","live").is("score_updated_at",null)),
    count(db?.from("fan_live_games").select("id",opt).eq("status","scheduled").gte("scheduled_at",now.toISOString()).lte("scheduled_at",upcoming)),
    count(db?.from("fan_live_games").select("id",opt).eq("status","scheduled").gte("scheduled_at",now.toISOString()).lte("scheduled_at",upcoming).is("opponent_team_id",null)),
    count(db?.from("fan_live_team_provider_map").select("team_id",opt).eq("active",true)),
    latest(),
  ]);
  // Count catalog sides separately; the legacy women's table may contain mirrors.
  const directoryCounts=await Promise.all([
    count(db?.from("leagues").select("id",opt).eq("active",true).eq("basketball_type","mens")),
    count(db?.from("leagues").select("id",opt).eq("active",true).eq("basketball_type","womens")),
    count(db?.from("womens_leagues").select("id",opt).eq("active",true)),
    count(db?.from("fan_live_games").select("id",opt).is("league_id",null)),
  ]);
  const labels=["API-Sports stored fixture records","Provider-marked live records","Live records with delayed snapshots","Live records without a snapshot timestamp","Scheduled fixtures in next 7 days","Upcoming fixtures missing opponent mapping","Active existing provider team mappings","Latest observed fixture snapshot (UTC)"];
  return <main className="page-shell"><div className="page-container" style={{display:"grid",gap:16,paddingBlock:24}}>
    <header className="hero-card"><p>HoopCheck™ · Private owner workspace</p><h1>Basketball Data Center</h1><p>Read-only database observations. A stored fixture or a recent snapshot is not proof of complete league coverage or live provider health.</p><Link href="/owner-hq" prefetch={false}>Back to Owner HQ</Link></header>
    <section aria-label="Basketball data observations" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
      {labels.map((label,i)=><div className="dashboard-card" key={label}><p>{label}</p><strong>{values[i]}</strong></div>)}
    </section>
    <section className="dashboard-card"><h2>Men’s and women’s directory audit</h2><p>Active men’s league directory records: <strong>{directoryCounts[0]}</strong></p><p>Active women’s league directory records: <strong>{directoryCounts[1]}</strong></p><p>Legacy women’s league records: <strong>{directoryCounts[2]}</strong> (reported separately; may overlap)</p><p>Stored fixtures without an internal league mapping: <strong>{directoryCounts[3]}</strong></p><p>Directory counts are not verified provider coverage. Official schedules and standings require reviewed provider competition mappings.</p></section>
    <section className="dashboard-card"><h2>Provider operations</h2><p>API-Sports scheduled cadence: 15 minutes, best effort. The configured schedule is not a measured upstream refresh interval.</p><p>BALLDONTLIE live writes, shared quota counters and complete-season coverage certification are not activated by this dashboard. Unavailable metrics are not zero.</p><Link href="/admin/directory/providers" prefetch={false}>Directory provider records</Link></section>
  </div></main>;
}
