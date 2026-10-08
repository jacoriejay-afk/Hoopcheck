"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";

type Kind = "coaches" | "teams-mens" | "teams-womens" | "leagues-mens" | "leagues-womens";
type Coach = { id:string; name:string; country:string|null; city:string|null; current_team_id:string|null; active:boolean };
type Team = { id:string; name:string; country:string|null; city:string|null; league_id:string|null; league_name:string|null; active:boolean; basketball_type:"mens"|"womens" };
type League = { id:string; name:string; country:string|null; level:string|null; season:string|null; active:boolean; basketball_type:"mens"|"womens" };

const REGIONS:Record<string,string[]> = {
 Europe:["Albania","Andorra","Armenia","Austria","Azerbaijan","Belarus","Belgium","Bosnia and Herzegovina","Bulgaria","Croatia","Cyprus","Czechia","Denmark","Estonia","Finland","France","Georgia","Germany","Greece","Hungary","Iceland","Ireland","Israel","Italy","Kosovo","Latvia","Lithuania","Luxembourg","Malta","Moldova","Montenegro","Netherlands","North Macedonia","Norway","Poland","Portugal","Romania","Russia","Serbia","Slovakia","Slovenia","Spain","Sweden","Switzerland","Türkiye","Ukraine","United Kingdom"],
 Asia:["China","Chinese Taipei","Hong Kong, China","Indonesia","Japan","Jordan","Lebanon","Malaysia","Mongolia","Philippines","Qatar","Saudi Arabia","South Korea","Thailand","UAE","United Arab Emirates"],
 Africa:["Algeria","Angola","Cameroon","Egypt","Ivory Coast","Mali","Morocco","Nigeria","Rwanda","Senegal","Tunisia","Uganda"],
 Americas:["Argentina","Brazil","Canada","Chile","Colombia","Mexico","Puerto Rico","Uruguay","USA","United States"],
 Oceania:["Australia","New Zealand","Fiji","Guam","Samoa","American Samoa","Papua New Guinea","New Caledonia","Vanuatu","Solomon Islands"]
};
const inputStyle:React.CSSProperties={width:"100%",padding:"11px 12px",borderRadius:8,border:"1px solid #303030",background:"#111",color:"#fff",boxSizing:"border-box"};

function Manager(){
 const params=useSearchParams(); const requested=params.get("kind");
 const initial:Kind=(["coaches","teams-mens","teams-womens","leagues-mens","leagues-womens"] as string[]).includes(requested||"")?requested as Kind:"coaches";
 const [kind,setKind]=useState<Kind>(initial),[coaches,setCoaches]=useState<Coach[]>([]),[teams,setTeams]=useState<Team[]>([]),[leagues,setLeagues]=useState<League[]>([]);
 const [search,setSearch]=useState(""),[region,setRegion]=useState("all"),[activeOnly,setActiveOnly]=useState(true),[editing,setEditing]=useState<string|null>(null),[form,setForm]=useState<Record<string,string|boolean>>({}),[message,setMessage]=useState(""),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const base=kind==="coaches"?"coaches":kind.startsWith("teams")?"teams":"leagues"; const gender=kind.endsWith("womens")?"womens":"mens";
 async function load(){setLoading(true);const [{data:c},{data:t},{data:l}]=await Promise.all([
  supabase.from("coaches").select("id,name,country,city,current_team_id,active").order("name").limit(1000),
  supabase.from("teams").select("id,name,country,city,league_id,league_name,active,basketball_type").order("name").limit(1000),
  supabase.from("leagues").select("id,name,country,level,season,active,basketball_type").order("name").limit(1000)
 ]);setCoaches(c||[]);setTeams(t||[]);setLeagues(l||[]);setLoading(false);}
 useEffect(()=>{void load()},[]);
 function startNew(){setEditing("new");setForm(base==="coaches"?{name:"",country:"",city:"",current_team_id:"",active:true}:base==="teams"?{name:"",country:"",city:"",league_id:"",league_name:"",active:true,basketball_type:gender}:{name:"",country:"",level:"",season:"2026-27",active:true,basketball_type:gender});setMessage("");}
 function startEdit(item:any){setEditing(item.id);setForm(Object.fromEntries(Object.entries(item).map(([k,v])=>[k,v??""])));setMessage("");}
 function cancel(){setEditing(null);setForm({});setMessage("");}
 async function save(){const name=String(form.name||"").trim();if(!name){setMessage("Name is required.");return;}setSaving(true);const clean=(v:any)=>String(v??"").trim()||null;let payload:any;
  if(base==="coaches")payload={name,country:clean(form.country),city:clean(form.city),current_team_id:clean(form.current_team_id),active:Boolean(form.active)};
  else if(base==="teams"){const league=leagues.find(l=>l.id===form.league_id&&l.basketball_type===gender);payload={name,country:clean(form.country),city:clean(form.city),league_id:clean(form.league_id),league_name:league?.name||clean(form.league_name),basketball_type:gender,active:Boolean(form.active)};}
  else payload={name,country:clean(form.country),level:clean(form.level),season:clean(form.season),basketball_type:gender,active:Boolean(form.active)};
  const result=editing==="new"?await supabase.from(base).insert(payload):await supabase.from(base).update(payload).eq("id",editing);setSaving(false);
  if(result.error){setMessage(result.error.message);return;}setMessage(editing==="new"?"Record created.":"Record updated.");cancel();await load();
 }
 async function archive(id:string){if(!confirm("Archive this directory record?"))return;const {error}=await supabase.from(base).update({active:false}).eq("id",id);if(error)setMessage(error.message);else{setMessage("Record archived.");await load();}}
 async function deleteRecord(id:string){const list:any[]=base==="coaches"?coaches:base==="teams"?teams:leagues;const item=list.find(x=>x.id===id);if(!item)return;if(!confirm(`Permanently delete "${item.name}"? This cannot be undone.`))return;const {error}=await supabase.rpc("admin_delete_directory_entry",{p_type:base.slice(0,-1),p_id:id});if(error)setMessage(error.message);else{setMessage("Record deleted.");await load();}}
 function getRegion(country:string|null){if(!country)return"Other";for(const [r,cs] of Object.entries(REGIONS))if(cs.includes(country))return r;return"Other";}
 const list:any[]=(base==="coaches"?coaches:base==="teams"?teams.filter(t=>t.basketball_type===gender):leagues.filter(l=>l.basketball_type===gender)).filter(item=>{if(activeOnly&&!item.active)return false;if(region!=="all"&&getRegion(item.country)!==region)return false;const q=search.trim().toLowerCase();return !q||[item.name,item.country,item.city,item.level,item.league_name].some(v=>String(v||"").toLowerCase().includes(q));});
 const tabs:[Kind,string][]=[["coaches","Coaches"],["teams-mens","Men’s Teams"],["teams-womens","Women’s Teams"],["leagues-mens","Men’s Leagues"],["leagues-womens","Women’s Leagues"]];
 return <main style={{minHeight:"100vh",background:"#050505",color:"#fff",padding:"35px 20px 80px"}}><div style={{maxWidth:1200,margin:"0 auto"}}>
  <div style={{display:"flex",justifyContent:"space-between",gap:15,flexWrap:"wrap",alignItems:"center",marginBottom:25}}><div><div style={{color:"#ff6a00",fontSize:11,fontWeight:900,letterSpacing:".15em"}}>HOOPCHECK ADMIN</div><h1 style={{fontSize:"clamp(2rem,5vw,3.5rem)",margin:"7px 0"}}>Directory Manager</h1><p style={{color:"#888",margin:0}}>Men’s and women’s professional basketball are managed separately.</p></div><div style={{display:"flex",gap:8}}><Link href="/admin/directory/relationships" style={{color:"#050505",background:"#ff6a00",padding:"11px 14px",borderRadius:8,fontWeight:900}}>Relationships</Link><Link href="/admin/directory" style={{color:"#fff",border:"1px solid #333",padding:"11px 14px",borderRadius:8}}>← Control Center</Link></div></div>
  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:18}}>{tabs.map(([value,label])=><button key={value} onClick={()=>{setKind(value);cancel()}} style={{padding:"11px 14px",borderRadius:8,border:kind===value?"1px solid #ff6a00":"1px solid #333",background:kind===value?"#ff6a00":"#111",color:kind===value?"#050505":"#fff",fontWeight:900}}>{label}</button>)}<button onClick={startNew} style={{marginLeft:"auto",padding:"11px 15px",border:0,borderRadius:8,background:"#ff6a00",fontWeight:900}}>+ Add {base==="coaches"?"Coach":base==="teams"?"Team":"League"}</button></div>
  {base!=="coaches"&&<div style={{padding:"10px 12px",marginBottom:12,border:"1px solid #292929",borderRadius:8,color:"#aaa"}}>{gender==="womens"?"Women’s":"Men’s"} directory only · {list.length} matching records</div>}
  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>{["all","Europe","Oceania","Asia","Africa","Americas","Other"].map(r=><button key={r} onClick={()=>setRegion(r)} style={{padding:"8px 11px",borderRadius:7,border:region===r?"1px solid #ff6a00":"1px solid #333",background:region===r?"#ff6a00":"#111",color:region===r?"#050505":"#fff"}}>{r==="all"?"All regions":r}</button>)}<button onClick={()=>setActiveOnly(v=>!v)} style={{padding:"8px 11px",borderRadius:7,border:"1px solid #333",background:"#111",color:"#fff"}}>{activeOnly?"Showing active":"Showing active + archived"}</button></div>
  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={"Search "+(base==="coaches"?"coaches":base)+"..."} style={{...inputStyle,marginBottom:18}}/>
  {editing&&<section style={{background:"#101010",border:"1px solid #292929",borderRadius:12,padding:20,marginBottom:20}}><h2 style={{marginTop:0}}>{editing==="new"?"Add record":"Edit record"}</h2><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
   <label>Name<input style={inputStyle} value={String(form.name||"")} onChange={e=>setForm({...form,name:e.target.value})}/></label>
   {base!=="leagues"&&<><label>Country<input style={inputStyle} value={String(form.country||"")} onChange={e=>setForm({...form,country:e.target.value})}/></label><label>City<input style={inputStyle} value={String(form.city||"")} onChange={e=>setForm({...form,city:e.target.value})}/></label></>}
   {base==="coaches"&&<label>Current Team<select style={inputStyle} value={String(form.current_team_id||"")} onChange={e=>setForm({...form,current_team_id:e.target.value})}><option value="">None</option>{teams.filter(t=>t.active&&t.basketball_type==="mens").map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
   {base==="teams"&&<><label>League<select style={inputStyle} value={String(form.league_id||"")} onChange={e=>setForm({...form,league_id:e.target.value})}><option value="">None</option>{leagues.filter(l=>l.active&&l.basketball_type===gender).map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label><label>Legacy League Name<input style={inputStyle} value={String(form.league_name||"")} onChange={e=>setForm({...form,league_name:e.target.value})}/></label></>}
   {base==="leagues"&&<><label>Level<input style={inputStyle} value={String(form.level||"")} onChange={e=>setForm({...form,level:e.target.value})}/></label><label>Season<input style={inputStyle} value={String(form.season||"")} onChange={e=>setForm({...form,season:e.target.value})}/></label></>}
   <label style={{display:"flex",alignItems:"center",gap:8}}><input type="checkbox" checked={Boolean(form.active)} onChange={e=>setForm({...form,active:e.target.checked})}/> Active</label></div><div style={{display:"flex",gap:9,marginTop:16}}><button onClick={save} disabled={saving} style={{padding:"11px 16px",border:0,borderRadius:8,background:"#ff6a00",fontWeight:900}}>{saving?"Saving...":"Save"}</button><button onClick={cancel} style={{padding:"11px 16px",border:"1px solid #333",borderRadius:8,background:"#111",color:"#fff"}}>Cancel</button></div></section>}
  {message&&<div style={{padding:12,marginBottom:15,borderRadius:8,background:"#151515",border:"1px solid #333"}}>{message}</div>}
  {loading?<p style={{color:"#888"}}>Loading...</p>:<div style={{display:"grid",gap:10}}>{list.map(item=><article key={item.id} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:15,alignItems:"center",padding:16,background:"#0e0e0e",border:"1px solid #252525",borderRadius:10}}><div><div style={{fontWeight:900,fontSize:17}}>{item.name}</div><div style={{color:"#888",fontSize:13,marginTop:5}}>{item.country||"Country not listed"}{item.city?" • "+item.city:""}{item.level?" • "+item.level:""}{item.league_name?" • "+item.league_name:""}{!item.active?" • ARCHIVED":""}</div></div><div style={{display:"flex",gap:7}}><button onClick={()=>startEdit(item)} style={{padding:"8px 11px",borderRadius:7,border:"1px solid #333",background:"#151515",color:"#fff"}}>Edit</button>{item.active&&<button onClick={()=>archive(item.id)} style={{padding:"8px 11px",borderRadius:7,border:"1px solid #542b20",background:"#1a100c",color:"#ff9a70"}}>Archive</button>}<button onClick={()=>deleteRecord(item.id)} style={{padding:"8px 11px",borderRadius:7,border:"1px solid #7a2d2d",background:"#1a0b0b",color:"#ff8f8f"}}>Delete</button></div></article>)}{!list.length&&<div style={{padding:30,textAlign:"center",color:"#777",border:"1px dashed #333",borderRadius:10}}>No records found.</div>}</div>}
 </div></main>;
}
export default function DirectoryManagerPage(){return <Suspense fallback={<main style={{minHeight:"100vh",background:"#050505",color:"#fff",padding:40}}>Loading directory manager...</main>}><Manager/></Suspense>}
