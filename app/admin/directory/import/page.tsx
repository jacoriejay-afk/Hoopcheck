"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";

type Kind = "coaches" | "teams" | "leagues" | "full_directory";

const templates: Record<Kind,string> = {
  coaches: "name,country,city\nCoach Name,Country,City",
  teams: "name,country,city,league_name\nTeam Name,Country,City,League Name",
  leagues: "name,country,level,season\nLeague Name,Country,Professional,2026-27",
  full_directory: "league_name,league_country,league_level,season,team_name,team_country,team_city,coach_name,coach_country,coach_city,coach_role,start_date,end_date\nLeague Name,Country,Professional,2026-27,Team Name,Country,City,Coach Name,Country,City,Head Coach,2026-09-01,2027-06-30",
};

function parseCsv(text: string) {
  const lines = text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const parseLine = (line:string) => {
    const out:string[]=[]; let cur=""; let quoted=false;
    for(let i=0;i<line.length;i++){ const ch=line[i]; if(ch==='"'){ if(quoted && line[i+1]==='"'){cur+='"';i++;} else quoted=!quoted; } else if(ch===',' && !quoted){out.push(cur.trim());cur="";} else cur+=ch; }
    out.push(cur.trim()); return out;
  };
  const headers=parseLine(lines[0]).map(x=>x.toLowerCase());
  return lines.slice(1).map((line)=>{const vals=parseLine(line); return Object.fromEntries(headers.map((h,i)=>[h,vals[i]||""]));});
}

export default function DirectoryImportPage(){
  const [kind,setKind]=useState<Kind>("leagues");
  const [csv,setCsv]=useState("");
  const [fileName,setFileName]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [jobs,setJobs]=useState<any[]>([]);

  async function loadJobs(){
    const {data}=await supabase.from("directory_import_jobs").select("id,kind,file_name,total_rows,inserted_rows,updated_rows,skipped_rows,error_rows,created_at").order("created_at",{ascending:false}).limit(10);
    setJobs(data||[]);
  }
  useEffect(()=>{void loadJobs()},[]);

  const rows=useMemo(()=>parseCsv(csv),[csv]);
  const required=kind==="full_directory"?["league_name"]:["name"];
  const valid=rows.filter(r=>required.every(k=>String(r[k]||"").trim()));

  async function importRows(){
    setMessage("");
    if(!valid.length){setMessage("Add a CSV with at least one valid row.");return;}
    setBusy(true);
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){setMessage("You must be signed in.");setBusy(false);return;}
    const job=await supabase.from("directory_import_jobs").insert({imported_by:user.id,kind,file_name:fileName||null,total_rows:rows.length}).select("id").single();
    if(job.error){setMessage(job.error.message);setBusy(false);return;}
    if (kind === "full_directory") {
      const { data, error } = await supabase.rpc("import_full_directory", {
        p_file_name: fileName || null,
        p_rows: valid,
      });
      if (error) {
        setMessage(error.message);
      } else {
        setMessage(`Full directory import complete: ${data.inserted_rows} inserted, ${data.updated_rows} updated, ${data.error_rows} errors. Relationships were connected automatically.`);
      }
      setBusy(false);
      await loadJobs();
      return;
    }

    let inserted=0,updated=0,skipped=0,errors=0;
    for(const row of valid){
      const name=String(row.name||"").trim();
      const country=String(row.country||"").trim()||null;
      let result:any;
      if(kind==="leagues"){
        const existing=await supabase.from("leagues").select("id").eq("name",name).eq("country",country).maybeSingle();
        if(existing.data){result=await supabase.from("leagues").update({level:String(row.level||"").trim()||null,season:String(row.season||"").trim()||null,active:true}).eq("id",existing.data.id); updated++;}
        else {result=await supabase.from("leagues").insert({name,country,level:String(row.level||"").trim()||null,season:String(row.season||"").trim()||null,active:true}); inserted++;}
      } else if(kind==="teams"){
        const existing=await supabase.from("teams").select("id").eq("name",name).eq("country",country).maybeSingle();
        const payload={name,country,city:String(row.city||"").trim()||null,league_name:String(row.league_name||"").trim()||null,active:true};
        if(existing.data){result=await supabase.from("teams").update(payload).eq("id",existing.data.id);updated++;} else {result=await supabase.from("teams").insert(payload);inserted++;}
      } else {
        const existing=await supabase.from("coaches").select("id").eq("name",name).eq("country",country).maybeSingle();
        const payload={name,country,city:String(row.city||"").trim()||null,active:true};
        if(existing.data){result=await supabase.from("coaches").update(payload).eq("id",existing.data.id);updated++;} else {result=await supabase.from("coaches").insert(payload);inserted++;}
      }
      if(result?.error){errors++; if(result.error.code==="23505") skipped++;}
    }
    await supabase.from("directory_import_jobs").update({inserted_rows:inserted,updated_rows:updated,skipped_rows:skipped,error_rows:errors}).eq("id",job.data.id);
    setMessage(`Import complete: ${inserted} inserted, ${updated} updated, ${errors} errors.`);
    setBusy(false); await loadJobs();
  }

  return <main style={{minHeight:"100vh",background:"#050505",color:"#fff",padding:"35px 20px 80px"}}><div style={{maxWidth:1200,margin:"0 auto"}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:15,flexWrap:"wrap",alignItems:"center"}}><div><div style={{color:"#ff6a00",fontSize:11,fontWeight:900,letterSpacing:".15em"}}>HOOPCHECK ADMIN</div><h1 style={{fontSize:"clamp(2rem,5vw,3.5rem)",margin:"7px 0"}}>Directory Import</h1><p style={{color:"#888"}}>Bulk-load leagues, teams, and coaches with CSV. Full Directory automatically connects League → Team → Coach and records historical relationships.</p></div><Link href="/admin/directory" style={{color:"#fff"}}>← Control Center</Link></div>
    <div style={{display:"flex",gap:8,margin:"25px 0"}}>{(["full_directory","leagues","teams","coaches"] as Kind[]).map(k=><button key={k} onClick={()=>setKind(k)} style={{padding:"11px 15px",borderRadius:8,border:"1px solid #333",background:kind===k?"#ff6a00":"#111",color:"#fff",fontWeight:900}}>{k === "full_directory" ? "full directory" : k}</button>)}</div>
    <section style={{background:"#101010",border:"1px solid #292929",borderRadius:12,padding:20}}>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}><input type="file" accept=".csv,text/csv" onChange={async e=>{const f=e.target.files?.[0];if(f){setFileName(f.name);setCsv(await f.text())}}}/><button onClick={()=>setCsv(templates[kind])} style={{padding:"10px 12px"}}>Load Template</button></div>
      <textarea value={csv} onChange={e=>setCsv(e.target.value)} placeholder={templates[kind]} style={{width:"100%",minHeight:220,marginTop:15,background:"#080808",color:"#fff",border:"1px solid #333",borderRadius:8,padding:12,boxSizing:"border-box",fontFamily:"monospace"}}/>
      <p style={{color:"#888"}}>{rows.length} rows detected • {valid.length} valid</p>
      <button disabled={busy} onClick={importRows} style={{padding:"12px 18px",border:0,borderRadius:8,background:"#ff6a00",fontWeight:900}}>{busy?"Importing...":"Import CSV"}</button>
      {message&&<p style={{marginTop:15}}>{message}</p>}
    </section>
    <section style={{marginTop:25}}><h2>Recent Imports</h2><div style={{display:"grid",gap:10}}>{jobs.map(j=><div key={j.id} style={{background:"#101010",border:"1px solid #292929",borderRadius:10,padding:15}}><strong>{j.kind}</strong> — {j.file_name||"pasted CSV"}<p style={{color:"#888",marginBottom:0}}>{j.inserted_rows} inserted · {j.updated_rows} updated · {j.error_rows} errors · {new Date(j.created_at).toLocaleString()}</p></div>)}</div></section>
  </div></main>;
}
