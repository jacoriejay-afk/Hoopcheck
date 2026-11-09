"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
type Inquiry = { id:string; created_at:string; type:string; message:string; user_id:string|null };
export default function BusinessInboxPage(){
 const [state,setState]=useState<"loading"|"denied"|"ready"|"error">("loading");
 const [items,setItems]=useState<Inquiry[]>([]);
 const [detail,setDetail]=useState("");
 useEffect(()=>{let active=true; async function load(){
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(!active)return;
  if(authError||!user){setState("denied");return;}
  const {data:role,error:roleError}=await supabase.rpc("get_current_user_admin_role");
  if(!active)return;
  if(roleError||role!=="admin"){setState("denied");return;}
  const {data,error}=await supabase.from("sponsor_inquiries").select("id,created_at,type,message,user_id").order("created_at",{ascending:false}).limit(100);
  if(!active)return;
  if(error){setDetail("The inbox is unavailable. The administrator read policy may not have been deployed.");setState("error");return;}
  setItems((data??[]) as Inquiry[]);setState("ready");
 }void load();return()=>{active=false}},[]);
 if(state==="loading")return <main className="mx-auto max-w-5xl p-6"><p role="status">Checking administrator access…</p></main>;
 if(state==="denied")return <main className="mx-auto max-w-5xl p-6"><h1 className="text-2xl font-bold">Access restricted</h1><p className="mt-3">This inbox is available only to authorized HoopCheck™ administrators.</p><Link href="/business" className="mt-4 inline-block underline">Business Center</Link></main>;
 return <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8"><Link href="/business" className="text-sm underline">← Business Center</Link><h1 className="mt-5 text-3xl font-black">Business inquiries</h1><p className="mt-3 text-sm opacity-80">Administrator-only view of the latest 100 inquiries. No edits or exports are enabled.</p>
 {state==="error"?<p role="alert" className="mt-6">{detail}</p>:items.length===0?<p className="mt-6">No inquiries available.</p>:<div className="mt-6 space-y-4">{items.map(item=><article key={item.id} className="rounded-2xl border border-current/20 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold capitalize">{item.type}</h2><time className="text-sm opacity-70" dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time></div><p className="mt-3 whitespace-pre-wrap break-words text-sm">{item.message}</p><p className="mt-3 break-all text-xs opacity-60">Account: {item.user_id??"deleted account"}</p></article>)}</div>}
 </main>;
}
