"use client";
import {useEffect,useState} from "react";
import {supabase} from "../lib/supabase";
type Entry={id:string;player_name:string;position:string|null;jersey_number:number|null;season:string|null;status:string;dispute_status:string;club_confirmed_at:string};
type Dispute={id:string;entry_id:string;reason:string;created_at:string;status:string};
type Audit={id:number;entry_id:string;actor_id:string|null;action:string;changed_at:string};
export default function ClubRosterManager({teamId,userId}:{teamId:string;userId:string}){
 const [entries,setEntries]=useState<Entry[]>([]);
 const [name,setName]=useState("");const [position,setPosition]=useState("");const [season,setSeason]=useState("");const [jersey,setJersey]=useState("");
 const [disputes,setDisputes]=useState<Dispute[]>([]);
 const [audit,setAudit]=useState<Audit[]>([]);
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 useEffect(()=>{let active=true;void supabase.from("club_roster_entries").select("id,player_name,position,jersey_number,season,status,dispute_status,club_confirmed_at").eq("team_id",teamId).order("player_name").then(({data,error})=>{if(active){setEntries((data||[]) as Entry[]);if(error)setMessage("Could not load roster.");}});return()=>{active=false}},[teamId]);
 useEffect(()=>{let active=true;void Promise.all([
 supabase.from("club_roster_disputes").select("id,entry_id,reason,created_at,status").eq("team_id",teamId).eq("status","pending").order("created_at",{ascending:false}),
 supabase.from("club_roster_change_log").select("id,entry_id,actor_id,action,changed_at").eq("team_id",teamId).order("changed_at",{ascending:false}).limit(30)
 ]).then(([d,a])=>{if(active){if(!d.error)setDisputes((d.data||[]) as Dispute[]);if(!a.error)setAudit((a.data||[]) as Audit[]);}});return()=>{active=false}},[teamId]);
 async function refresh(){const {data,error}=await supabase.from("club_roster_entries").select("id,player_name,position,jersey_number,season,status,dispute_status,club_confirmed_at").eq("team_id",teamId).order("player_name");if(error)setMessage(error.message);else setEntries((data||[]) as Entry[]);}
 async function add(){if(!name.trim()||busy)return;setBusy(true);const {error}=await supabase.from("club_roster_entries").insert({team_id:teamId,updated_by:userId,player_name:name.trim(),position:position.trim()||null,season:season.trim()||null,jersey_number:jersey===""?null:Number(jersey)});if(error)setMessage(error.message);else{setName("");setPosition("");setJersey("");setMessage("Roster entry added.");await refresh()}setBusy(false);}
 async function correctName(entry:Entry){const value=window.prompt("Correct player name",entry.player_name);if(!value?.trim()||value.trim()===entry.player_name||busy)return;setBusy(true);const {error}=await supabase.from("club_roster_entries").update({player_name:value.trim(),updated_by:userId}).eq("id",entry.id).eq("team_id",teamId);if(error)setMessage(error.message);else{setMessage("Name correction recorded in the change log.");await refresh()}setBusy(false);}
 async function depart(entry:Entry){const value=window.prompt("Departure season",entry.season||"");if(!value?.trim()||busy)return;setBusy(true);const {error}=await supabase.from("club_roster_entries").update({status:"departed",season:value.trim(),updated_by:userId}).eq("id",entry.id).eq("team_id",teamId);if(error)setMessage(error.message);else{setMessage("Departure recorded.");await refresh()}setBusy(false);}
 return <section className="dashboard-card" aria-label="Club roster manager" style={{marginTop:12}}><p className="eyebrow">CLUB-CONFIRMED</p><h2>Roster Board</h2><p className="muted">Club roster entries are audited. Wire and follower alerts are not connected yet.</p>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8}}>
 <input aria-label="Player name" placeholder="Player name" maxLength={120} value={name} onChange={e=>setName(e.target.value)}/>
 <input aria-label="Position" placeholder="Position" maxLength={60} value={position} onChange={e=>setPosition(e.target.value)}/>
 <input aria-label="Jersey number" placeholder="Jersey #" type="number" min={0} max={99} value={jersey} onChange={e=>setJersey(e.target.value)}/>
 <input aria-label="Season" placeholder="Season" value={season} onChange={e=>setSeason(e.target.value)}/></div>
 <button type="button" className="btn" disabled={busy||!name.trim()} onClick={()=>void add()}>Add player</button>
 {message&&<p role="status">{message}</p>}
 {entries.map(e=><div key={e.id} className="card" style={{marginTop:8}}><strong>{e.player_name}</strong> · {e.position||"Position unlisted"} {e.jersey_number!==null?"#"+e.jersey_number:""}<p className="muted">{e.status==="departed"?"Departed":"Active"} · {e.season||"Season unlisted"} · {e.dispute_status==="pending"?"Disputed · ":""}Club-confirmed · {new Date(e.club_confirmed_at).toLocaleDateString()}</p><button type="button" className="btn dark" disabled={busy} onClick={()=>void correctName(e)}>Correct name</button> {e.status==="active"&&<button type="button" className="btn dark" disabled={busy} onClick={()=>void depart(e)}>Mark departed</button>}</div>)}
 {!entries.length&&<p className="muted">No roster entries yet.</p>}
 <h3>Roster disputes {disputes.length>0?"("+disputes.length+")":""}</h3>
 {disputes.length?disputes.map(d=><article key={d.id} className="card" style={{marginTop:8}}>
 <strong>{entries.find(e=>e.id===d.entry_id)?.player_name||"Roster entry"}</strong>
 <p>{d.reason}</p><small className="muted">Awaiting HoopCheck moderation · {new Date(d.created_at).toLocaleDateString()}</small>
 </article>):<p className="muted">No pending roster disputes.</p>}
 <h3>Recent roster changes</h3>
 {audit.map(a=><p key={a.id} className="muted">{a.action} · {entries.find(e=>e.id===a.entry_id)?.player_name||"Roster entry"} · {a.actor_id||"System"} · {new Date(a.changed_at).toLocaleString()}</p>)}
 {!audit.length&&<p className="muted">No roster changes recorded yet.</p>}
 </section>;
}
