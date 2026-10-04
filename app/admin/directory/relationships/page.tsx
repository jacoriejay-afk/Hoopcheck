"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";

type Coach = { id: string; name: string };
type Team = { id: string; name: string };
type League = { id: string; name: string };
type Assignment = { id: string; coach_id: string; team_id: string; role: string | null; season: string | null; active: boolean; coach?: Coach; team?: Team };
type Membership = { id: string; team_id: string; league_id: string; season: string | null; start_date: string | null; end_date: string | null; active: boolean; team?: Team; league?: League };

const input: React.CSSProperties = { width: "100%", padding: "10px 11px", background: "#111", color: "#fff", border: "1px solid #333", borderRadius: 8, boxSizing: "border-box" };

export default function RelationshipsPage() {
  const [tab, setTab] = useState<"coach" | "league">("coach");
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [form, setForm] = useState<Record<string,string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [c,t,l,a,m] = await Promise.all([
      supabase.from("coaches").select("id,name").eq("active",true).order("name"),
      supabase.from("teams").select("id,name").eq("active",true).order("name"),
      supabase.from("leagues").select("id,name").eq("active",true).order("name"),
      supabase.from("coach_team_assignments").select("id,coach_id,team_id,role,season,active").order("created_at",{ascending:false}),
      supabase.from("team_league_memberships").select("id,team_id,league_id,season,start_date,end_date,active").order("created_at",{ascending:false}),
    ]);
    setCoaches(c.data || []); setTeams(t.data || []); setLeagues(l.data || []);
    setAssignments(a.data || []); setMemberships(m.data || []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  function reset() { setEditing(null); setForm({}); setMessage(""); }

  async function save() {
    setMessage("");
    if (tab === "coach") {
      if (!form.coach_id || !form.team_id) { setMessage("Choose a coach and team."); return; }
      const payload = { coach_id: form.coach_id, team_id: form.team_id, role: form.role?.trim() || null, season: form.season?.trim() || null, active: form.active !== "false" };
      const result = editing ? await supabase.from("coach_team_assignments").update(payload).eq("id",editing) : await supabase.from("coach_team_assignments").insert(payload);
      if (result.error) { setMessage(result.error.message); return; }
    } else {
      if (!form.team_id || !form.league_id) { setMessage("Choose a team and league."); return; }
      const payload = { team_id: form.team_id, league_id: form.league_id, season: form.season?.trim() || null, start_date: form.start_date || null, end_date: form.end_date || null, active: form.active !== "false" };
      const result = editing ? await supabase.from("team_league_memberships").update(payload).eq("id",editing) : await supabase.from("team_league_memberships").insert(payload);
      if (result.error) { setMessage(result.error.message); return; }
    }
    reset(); setMessage("Relationship saved."); await load();
  }

  async function archive(id: string) {
    if (!confirm("Archive this relationship?")) return;
    const table = tab === "coach" ? "coach_team_assignments" : "team_league_memberships";
    const { error } = await supabase.from(table).update({ active:false }).eq("id",id);
    if (error) setMessage(error.message); else { setMessage("Relationship archived."); await load(); }
  }

  const coachRows = assignments.map(a => ({...a, coach: coaches.find(c=>c.id===a.coach_id), team: teams.find(t=>t.id===a.team_id)}));
  const leagueRows = memberships.map(m => ({...m, team: teams.find(t=>t.id===m.team_id), league: leagues.find(l=>l.id===m.league_id)}));

  return <main style={{minHeight:"100vh",background:"#050505",color:"#fff",padding:"35px 20px 80px"}}>
    <div style={{maxWidth:1100,margin:"0 auto"}}>
      <Link href="/admin/directory/manage" style={{color:"#aaa",textDecoration:"none"}}>← Directory Manager</Link>
      <h1 style={{fontSize:"clamp(2rem,5vw,3.5rem)",margin:"15px 0 5px"}}>Relationship Manager</h1>
      <p style={{color:"#888"}}>Track coach assignments and team league history by season.</p>
      <div style={{display:"flex",gap:8,margin:"20px 0"}}>
        <button onClick={()=>{setTab("coach");reset()}} style={button(tab==="coach")}>Coach → Team</button>
        <button onClick={()=>{setTab("league");reset()}} style={button(tab==="league")}>Team → League</button>
        <button onClick={()=>setForm(tab==="coach"?{active:"true"}:{active:"true"})} style={{...button(false),marginLeft:"auto"}}>+ New</button>
      </div>
      {form && Object.keys(form).length>0 && <section style={{background:"#101010",border:"1px solid #292929",borderRadius:12,padding:18,marginBottom:18}}>
        <h2 style={{marginTop:0}}>{editing?"Edit":"Add"} relationship</h2>
        {tab==="coach" ? <div style={grid()}>
          <label>Coach<select style={input} value={form.coach_id||""} onChange={e=>setForm({...form,coach_id:e.target.value})}><option value="">Select coach</option>{coaches.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label>Team<select style={input} value={form.team_id||""} onChange={e=>setForm({...form,team_id:e.target.value})}><option value="">Select team</option>{teams.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label>Role<input style={input} value={form.role||""} onChange={e=>setForm({...form,role:e.target.value})} placeholder="Head Coach" /></label>
          <label>Season<input style={input} value={form.season||""} onChange={e=>setForm({...form,season:e.target.value})} placeholder="2026-27" /></label>
        </div> : <div style={grid()}>
          <label>Team<select style={input} value={form.team_id||""} onChange={e=>setForm({...form,team_id:e.target.value})}><option value="">Select team</option>{teams.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label>League<select style={input} value={form.league_id||""} onChange={e=>setForm({...form,league_id:e.target.value})}><option value="">Select league</option>{leagues.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label>Season<input style={input} value={form.season||""} onChange={e=>setForm({...form,season:e.target.value})} placeholder="2026-27" /></label>
          <label>Start date<input type="date" style={input} value={form.start_date||""} onChange={e=>setForm({...form,start_date:e.target.value})} /></label>
          <label>End date<input type="date" style={input} value={form.end_date||""} onChange={e=>setForm({...form,end_date:e.target.value})} /></label>
        </div>}
        <div style={{display:"flex",gap:8,marginTop:15}}><button onClick={save} style={button(true)}>Save</button><button onClick={reset} style={button(false)}>Cancel</button></div>
      </section>}
      {message && <div style={{padding:11,background:"#151515",border:"1px solid #333",borderRadius:8,marginBottom:14}}>{message}</div>}
      {loading ? <p style={{color:"#888"}}>Loading relationships...</p> : <div style={{display:"grid",gap:9}}>
        {tab==="coach" ? coachRows.map(r=><Row key={r.id} title={(r.coach?.name||"Unknown coach")+" → "+(r.team?.name||"Unknown team")} meta={[r.role,r.season,!r.active&&"ARCHIVED"].filter(Boolean).join(" • ")} onEdit={()=>{setEditing(r.id);setForm({coach_id:r.coach_id,team_id:r.team_id,role:r.role||"",season:r.season||"",active:String(r.active)})}} onArchive={()=>archive(r.id)} active={r.active}/>) :
        leagueRows.map(r=><Row key={r.id} title={(r.team?.name||"Unknown team")+" → "+(r.league?.name||"Unknown league")} meta={[r.season,r.start_date&&("from "+r.start_date),r.end_date&&("to "+r.end_date),!r.active&&"ARCHIVED"].filter(Boolean).join(" • ")} onEdit={()=>{setEditing(r.id);setForm({team_id:r.team_id,league_id:r.league_id,season:r.season||"",start_date:r.start_date||"",end_date:r.end_date||"",active:String(r.active)})}} onArchive={()=>archive(r.id)} active={r.active}/>)}
        {!((tab==="coach"?coachRows:leagueRows).length) && <div style={{padding:30,textAlign:"center",color:"#777",border:"1px dashed #333",borderRadius:10}}>No relationships yet.</div>}
      </div>}
    </div>
  </main>
}
function Row({title,meta,onEdit,onArchive,active}:{title:string;meta:string;onEdit:()=>void;onArchive:()=>void;active:boolean}) {
 return <article style={{display:"grid",gridTemplateColumns:"1fr auto",gap:12,alignItems:"center",padding:15,background:"#0e0e0e",border:"1px solid #252525",borderRadius:10}}><div><b>{title}</b><div style={{color:"#888",fontSize:13,marginTop:5}}>{meta||"No season set"}</div></div><div style={{display:"flex",gap:7}}><button onClick={onEdit} style={button(false)}>Edit</button>{active&&<button onClick={onArchive} style={{...button(false),color:"#ff9a70"}}>Archive</button>}</div></article>
}
function button(active:boolean):React.CSSProperties{return {padding:"10px 13px",borderRadius:8,border:"1px solid #333",background:active?"#ff6a00":"#111",color:active?"#050505":"#fff",fontWeight:900}}
function grid():React.CSSProperties{return {display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:12}}
