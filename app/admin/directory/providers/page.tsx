"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

type Source={id:string;name:string;base_url:string|null;documentation_url:string|null;license_notes:string|null;connector_key:string|null;active:boolean;updated_at:string};
type SyncRun={id:string;source_id:string;entity_type:string;status:string;records_seen:number;records_created:number;records_updated:number;records_skipped:number;error_message:string|null;started_at:string;finished_at:string|null};

export default function DirectoryProvidersPage(){
 const router=useRouter(); const [sources,setSources]=useState<Source[]>([]); const [runs,setRuns]=useState<SyncRun[]>([]);
 const [loading,setLoading]=useState(true); const [preview,setPreview]=useState<any>(null); const [saving,setSaving]=useState(false); const [name,setName]=useState(""); const [baseUrl,setBaseUrl]=useState(""); const [docsUrl,setDocsUrl]=useState(""); const [licenseNotes,setLicenseNotes]=useState(""); const [connectorKey,setConnectorKey]=useState(""); const [message,setMessage]=useState(""); const [error,setError]=useState(""); const [syncing,setSyncing]=useState<string|null>(null); const [batchOffsets,setBatchOffsets]=useState<Record<string,number>>({});
 async function load(){
  const {data:{session}}=await supabase.auth.getSession(); if(!session?.user){router.replace("/login");return;}
  const {data:allowed}=await supabase.rpc("is_current_user_admin_or_moderator"); if(!allowed){router.replace("/dashboard");return;}
  const [{data:sourceData,error:sourceError},{data:runData,error:runError}]=await Promise.all([
   supabase.from("directory_sources").select("*").order("name"),
   supabase.from("directory_sync_runs").select("*").order("started_at",{ascending:false}).limit(30)
  ]);
  if(sourceError||runError)setError(sourceError?.message??runError?.message??"Unable to load provider data.");
  else{setSources((sourceData??[]) as Source[]);setRuns((runData??[]) as SyncRun[]);} setLoading(false);
 }
 useEffect(()=>{void load();},[]);
 async function addSource(e:React.FormEvent){e.preventDefault();setSaving(true);setError("");setMessage("");
  const {error:e1}=await supabase.from("directory_sources").insert({name:name.trim(),base_url:baseUrl.trim()||null,documentation_url:docsUrl.trim()||null,license_notes:licenseNotes.trim()||null,connector_key:connectorKey.trim()||null,active:true});
  if(e1)setError(e1.message);else{setName("");setBaseUrl("");setDocsUrl("");setLicenseNotes("");setConnectorKey("");setMessage("Provider added. No external data has been imported.");await load();}setSaving(false);
 }
 async function previewSync(s:Source, entityType:"leagues"|"teams"|"coaches"){ setError("");setMessage(""); const {data:{session}}=await supabase.auth.getSession(); const res=await fetch("/api/admin/directory/sync/preview",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session?.access_token??""}`},body:JSON.stringify({source_id:s.id,entity_type:entityType})}); const data=await res.json(); if(!res.ok)setError(data.error||"Preview failed.");else{setPreview(data.preview);setMessage(`Preview ready: ${data.preview.create_count} create, ${data.preview.update_count} update, ${data.preview.skip_count} skip. It expires in 30 minutes.`);} } async function approvePreview(){if(!preview)return;setError("");setMessage("");const {data:{session}}=await supabase.auth.getSession();const res=await fetch("/api/admin/directory/sync/approve",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session?.access_token??""}`},body:JSON.stringify({preview_id:preview.id})});const data=await res.json();if(!res.ok)setError(data.error||"Approval failed.");else{setMessage(`Approved and imported: ${data.created} created, ${data.updated} updated, ${data.skipped} skipped.`);setPreview(null);await load();}}
 async function startSync(s:Source, entityType:"leagues"|"teams"|"coaches"){
 const key=s.id+entityType; const offset=batchOffsets[key]??0;
 setSyncing(key);setError("");setMessage("");
 try{
  const {data:{session}}=await supabase.auth.getSession();
  if(!session?.access_token){setError("Your session has expired. Please log in again.");return;}
  setMessage(`Syncing ${entityType} batch starting at ${offset}...`);
  const res=await fetch("/api/admin/directory/sync",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({source_id:s.id,entity_type:entityType,offset,limit:25})});
  const data=await res.json();
  if(!res.ok)throw new Error(data.error||"Directory sync failed.");
  if(data.batch?.has_more){
   const next=Number(data.batch.next_offset||offset+25);
   setBatchOffsets(prev=>({...prev,[key]:next}));
   setMessage(`Batch complete: ${data.created||0} created, ${data.updated||0} updated, ${data.skipped||0} skipped. Next batch starts at ${next}.`);
  }else{
   setBatchOffsets(prev=>({...prev,[key]:0}));
   setMessage(`Completed ${entityType} sync for ${s.name}: ${data.created||0} created, ${data.updated||0} updated, ${data.skipped||0} skipped.`);
  }
  await load();
 }catch(error){setError(error instanceof Error?error.message:"Unable to sync directory.");}
 finally{setSyncing(null);}
 }
 async function toggleSource(s:Source){setError("");const {error:e1}=await supabase.from("directory_sources").update({active:!s.active}).eq("id",s.id);if(e1)setError(e1.message);else await load();}
 if(loading)return <main style={styles.page}><div style={styles.loader}>Loading provider center...</div></main>;
 return <main style={styles.page}><div style={styles.shell}>
  <header style={styles.header}><div><p style={styles.eyebrow}>HOOPCHECK ADMIN</p><h1 style={styles.title}>Data Provider Center</h1><p style={styles.subtitle}>Register licensed or approved basketball data sources before connecting a sync.</p></div><div style={styles.actions}><Link href="/admin/directory/import" style={styles.secondary}>CSV Import</Link><Link href="/admin/directory" style={styles.secondary}>Directory</Link></div></header>
  {message&&<div style={styles.success}>{message}</div>}{error&&<div style={styles.error}>{error}</div>}{preview&&<section style={styles.panel}><p style={styles.section}>PENDING APPROVAL</p><h2 style={styles.heading}>{preview.entity_type} sync preview</h2><p style={styles.muted}>{preview.create_count} create · {preview.update_count} update · {preview.skip_count} skip · expires {new Date(preview.expires_at).toLocaleTimeString()}</p><button onClick={()=>void approvePreview()} style={styles.primary}>Approve & Import This Preview</button></section>}
  <section style={styles.panel}><p style={styles.section}>PROVIDER REGISTRY</p><h2 style={styles.heading}>Add a data provider</h2><p style={styles.muted}>This records provider and licensing context. It does not scrape or import data.</p>
   <form onSubmit={addSource} style={styles.form}><input required value={name} onChange={e=>setName(e.target.value)} placeholder="Provider name" style={styles.input}/><input value={baseUrl} onChange={e=>setBaseUrl(e.target.value)} placeholder="Base URL" style={styles.input}/><input value={docsUrl} onChange={e=>setDocsUrl(e.target.value)} placeholder="Documentation URL" style={styles.input}/><textarea value={licenseNotes} onChange={e=>setLicenseNotes(e.target.value)} placeholder="License / usage notes" style={styles.textarea}/><input value={connectorKey} onChange={e=>setConnectorKey(e.target.value)} placeholder="Connector key (e.g. mock)" style={styles.input}/><button disabled={saving} style={styles.primary}>{saving?"Saving...":"Add Provider"}</button></form>
  </section>
  <section style={styles.panel}><p style={styles.section}>REGISTERED SOURCES</p>{sources.length===0?<p style={styles.muted}>No providers registered yet.</p>:<div style={styles.list}>{sources.map(s=><div key={s.id} style={styles.row}><div><strong>{s.name}</strong><div style={styles.small}>Connector: {s.connector_key||"not configured"}</div><div style={styles.small}>{s.base_url||"No base URL"} · {s.license_notes||"No license notes"}</div></div><div style={styles.rowActions}><span style={{...styles.badge,...(s.active?styles.active:styles.inactive)}}>{s.active?"ACTIVE":"PAUSED"}</span><button onClick={()=>void previewSync(s,"leagues")} disabled={syncing===s.id+"leagues"} style={styles.secondary}>Preview Leagues</button><button onClick={()=>void previewSync(s,"teams")} disabled={syncing===s.id+"teams"} style={styles.secondary}>Preview Teams</button><button onClick={()=>void previewSync(s,"coaches")} disabled={syncing===s.id+"coaches"} style={styles.secondary}>Preview Coaches</button><button onClick={()=>void startSync(s,"leagues")} style={styles.primary}>Sync Leagues{batchOffsets[s.id+"leagues"]?` (Next ${batchOffsets[s.id+"leagues"]})`:""}</button><button onClick={()=>void startSync(s,"teams")} style={styles.primary}>Sync Teams{batchOffsets[s.id+"teams"]?` (Next ${batchOffsets[s.id+"teams"]})`:""}</button><button onClick={()=>void startSync(s,"coaches")} style={styles.primary}>Sync Coaches{batchOffsets[s.id+"coaches"]?` (Next ${batchOffsets[s.id+"coaches"]})`:""}</button><button onClick={()=>void toggleSource(s)} style={styles.secondary}>{s.active?"Pause":"Activate"}</button></div></div>)}</div>}</section>
  <section style={styles.panel}><p style={styles.section}>SYNC HISTORY</p>{runs.length===0?<p style={styles.muted}>No sync runs yet. The registry is ready for a licensed connector.</p>:<div style={styles.list}>{runs.map(r=><div key={r.id} style={styles.row}><div><strong>{r.entity_type} · {r.status}</strong><div style={styles.small}>{new Date(r.started_at).toLocaleString()} · seen {r.records_seen} · created {r.records_created} · updated {r.records_updated}</div></div>{r.error_message&&<span style={styles.errorText}>{r.error_message}</span>}</div>)}</div>}</section>
 </div></main>;
}
const styles:Record<string,React.CSSProperties>={page:{minHeight:"100vh",background:"#050505",color:"#fff",padding:"40px 24px 80px"},shell:{width:"min(1100px,100%)",margin:"0 auto"},header:{display:"flex",justifyContent:"space-between",gap:20,flexWrap:"wrap",marginBottom:28},eyebrow:{margin:"0 0 8px",color:"#ff6a00",fontSize:12,fontWeight:900,letterSpacing:".16em"},title:{margin:0,fontSize:"clamp(2.3rem,5vw,4rem)",letterSpacing:"-.06em",lineHeight:1,fontWeight:950},subtitle:{color:"#888",margin:"14px 0 0",maxWidth:700},actions:{display:"flex",gap:10},panel:{background:"#111",border:"1px solid #282828",borderRadius:16,padding:22,marginBottom:18},section:{margin:"0 0 7px",color:"#ff6a00",fontSize:10,fontWeight:900,letterSpacing:".14em"},heading:{margin:0,fontSize:"1.4rem",fontWeight:950},muted:{color:"#888",lineHeight:1.6},form:{display:"grid",gap:11,marginTop:18},input:{width:"100%",boxSizing:"border-box",background:"#090909",color:"#fff",border:"1px solid #303030",borderRadius:9,padding:"12px 13px"},textarea:{minHeight:90,width:"100%",boxSizing:"border-box",background:"#090909",color:"#fff",border:"1px solid #303030",borderRadius:9,padding:"12px 13px",resize:"vertical"},primary:{border:0,borderRadius:9,padding:"12px 16px",background:"#ff6a00",color:"#050505",fontWeight:950,cursor:"pointer"},secondary:{border:"1px solid #303030",borderRadius:9,padding:"10px 13px",background:"#171717",color:"#fff",textDecoration:"none",fontWeight:800,cursor:"pointer"},list:{display:"grid",gap:10},row:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap",padding:15,border:"1px solid #292929",borderRadius:11,background:"#0b0b0b"},rowActions:{display:"flex",alignItems:"center",gap:9},small:{color:"#777",fontSize:12,marginTop:5},badge:{padding:"6px 9px",borderRadius:999,fontSize:9,fontWeight:950,letterSpacing:".08em"},active:{background:"rgba(50,200,100,.1)",color:"#7ee2a0"},inactive:{background:"rgba(255,100,100,.1)",color:"#ff9999"},success:{padding:13,borderRadius:10,marginBottom:18,background:"rgba(70,210,120,.08)",border:"1px solid rgba(70,210,120,.25)",color:"#8be6aa"},error:{padding:13,borderRadius:10,marginBottom:18,background:"rgba(255,60,60,.08)",border:"1px solid rgba(255,60,60,.3)",color:"#ff9999"},errorText:{color:"#ff9999",fontSize:12},loader:{minHeight:"60vh",display:"grid",placeItems:"center",color:"#aaa"}};
