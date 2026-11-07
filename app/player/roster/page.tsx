"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {supabase} from "../../../lib/supabase";
type Entry={id:string;team_id:string;player_name:string;position:string|null;status:string;dispute_status:string;club_confirmed_at:string};
export default function MyRosterEntries(){
const [entries,setEntries]=useState<Entry[]>([]);const [reason,setReason]=useState<Record<string,string>>({});const [loading,setLoading]=useState(true);const [busy,setBusy]=useState("");const [message,setMessage]=useState("");
 async function refresh(uid:string){const {data,error}=await supabase.from("club_roster_entries").select("id,team_id,player_name,position,status,dispute_status,club_confirmed_at").eq("player_id",uid).order("club_confirmed_at",{ascending:false});if(error)setMessage(error.message);else setEntries((data||[]) as Entry[]);}
 useEffect(()=>{let active=true;void(async()=>{const {data:{user}}=await supabase.auth.getUser();if(!active)return;if(!user){setMessage("Sign in to review entries linked to your player profile.");setLoading(false);return;}await refresh(user.id);if(active)setLoading(false)})();return()=>{active=false}},[]);
 async function dispute(entry:Entry){const text=reason[entry.id]?.trim()||"";if(text.length<10||busy)return;setBusy(entry.id);setMessage("");const {error}=await supabase.rpc("dispute_my_club_roster_entry",{p_entry_id:entry.id,p_reason:text});if(error)setMessage(error.message);else{setMessage("Dispute submitted for HoopCheck moderation.");const {data:{user}}=await supabase.auth.getUser();if(user)await refresh(user.id)}setBusy("");}
 return <main className="page-shell"><div className="page-container"><header className="hero-card"><p className="eyebrow">PLAYER PROTECTION</p><h1>My club roster entries</h1><p className="muted">Review club-confirmed entries linked to your HoopCheck profile. If a club listed you incorrectly, submit a dispute for moderation.</p></header>
 {message&&<p role="status">{message}</p>}
 {loading?<p>Loading…</p>:entries.length?entries.map(e=><article key={e.id} className="dashboard-card" style={{marginTop:12}}><strong>{e.player_name}</strong> · {e.position||"Position unlisted"}<p className="muted"><Link href={"/teams/"+e.team_id}>View club</Link> · {e.status} · {e.dispute_status==="pending"?"Disputed · ":""}Club-confirmed · {new Date(e.club_confirmed_at).toLocaleDateString()}</p>
 {e.dispute_status==="pending"?<p>Under moderation review.</p>:<><label htmlFor={"reason-"+e.id}>Dispute this entry</label><textarea id={"reason-"+e.id} rows={3} maxLength={1000} placeholder="Explain why this club roster entry is incorrect…" value={reason[e.id]||""} onChange={event=>setReason(current=>({...current,[e.id]:event.target.value}))}/><button type="button" className="btn" disabled={!!busy||(reason[e.id]?.trim().length||0)<10} onClick={()=>void dispute(e)}>Submit dispute</button></>}
 </article>):<p className="muted">No roster entries are linked to your profile yet. Name-only entries require identity verification before a dispute can be submitted.</p>}
 <Link href="/dashboard">Back to dashboard</Link></div></main>;
}
