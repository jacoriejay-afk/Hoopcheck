"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import TeamLogo from "../../../components/TeamLogo";

type League = { id: string; name: string; country: string | null; logo_url: string | null; website: string | null };
const PAGE = 30;

function checkImageUrl(candidate: string): string | null {
  const value = candidate.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname.includes(".") || url.username || url.password || /(?:^|\.)(localhost|local|internal)$/i.test(url.hostname)) return null;
    if (url.port && url.port !== "443") return null;
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(url.hostname)) return null;
    if (value.length > 1500) return null;
    return url.toString();
  } catch { return null; }
}

export default function AdminLeagueLogosPage() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [query, setQuery] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [source, setSource] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    const { data: permitted, error: permissionError } = await supabase.rpc("is_current_user_admin_or_moderator");
    if (permissionError || permitted !== true) {
      setNotice("You must be an authorized directory administrator to manage league logos.");
      setAuthorized(false); setLoading(false); return;
    }
    setAuthorized(true);
    const rows: League[] = [];
    for (let offset = 0; offset < 3000; offset += 500) {
      const { data, error } = await supabase.from("leagues").select("id,name,country,logo_url,website").order("id").range(offset, offset + 499);
      if (error) { setNotice("Could not load the complete league directory.");setLoading(false);return; }
      const batch = (data || []) as League[];
      rows.push(...batch);
      if (batch.length < 500) break;
    }
    setLeagues(rows);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const match = useMemo(() => leagues.filter(item => {
    if (onlyMissing && item.logo_url) return false;
    const term = query.toLowerCase().trim();
    return !term || [item.name,item.country,item.website].some(value=>value?.toLowerCase().includes(term));
  }).sort((a,b) => (a.country || "").localeCompare(b.country || "") || a.name.localeCompare(b.name)),[leagues,onlyMissing,query]);
  const current = leagues.find(item=>item.id===selected);
  const missing = leagues.filter(item=>!item.logo_url).length;
  const visible = match.slice(page*PAGE,(page+1)*PAGE);

  function choose(item: League) {
    setSelected(item.id);
    setLogoUrl(item.logo_url || "");
    setSource(item.website || "");
    setConfirmed(false);
    setNotice("");
  }
  async function save() {
    if (!current || !authorized || working) return;
    const validUrl = checkImageUrl(logoUrl);
    const evidence = source.trim();
    if (!validUrl || !checkImageUrl(evidence) || !confirmed) {
      setNotice("Provide valid HTTPS logo and official source URLs, then confirm rights and identity.");
      return;
    }
    setWorking(true);setNotice("");
    const { error } = await supabase.from("leagues").update({ logo_url: validUrl }).eq("id",current.id);
    if (error) setNotice("The league logo was not saved. Check administrator permissions.");
    else {
      setLeagues(items=>items.map(item=>item.id===current.id ? {...item,logo_url:validUrl} : item));
      setConfirmed(false);
      setNotice("Logo URL saved for this league. Verify rendering and its source before release.");
    }
    setWorking(false);
  }
  async function revert() {
    if (!current || !authorized || working || !current.logo_url) return;
    if (!window.confirm("Restore the league's placeholder badge?")) return;
    setWorking(true);
    const { error } = await supabase.from("leagues").update({ logo_url: null }).eq("id",current.id);
    if (error) setNotice("Could not revert this logo.");
    else { setLeagues(items=>items.map(item=>item.id===current.id ? {...item,logo_url:null} : item));setLogoUrl("");setConfirmed(false);setNotice("Placeholder badge restored."); }
    setWorking(false);
  }

  return <main className="page-shell hc-league-logo-admin"><div className="page-container" style={{maxWidth:1100}}>
    <header style={{margin:"24px 0"}}><p className="eyebrow">DIRECTORY ADMINISTRATION</p><h1>League logo studio</h1><p className="muted">Official assets only. This workflow never guesses logo sources or mass-applies unverified images.</p><Link href="/admin/directory/manage?kind=leagues-mens">Back to league manager</Link></header>
    {notice && <p role="status">{notice}</p>}
    {loading ? <p role="status">Checking authorization and league coverage…</p> : !authorized ? <p>Access restricted.</p> : <>
      <section className="dashboard-card"><h2>Coverage</h2><p>{leagues.length-missing} recorded URLs · {missing} leagues need verified logo assets · {leagues.length} league records</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:12,margin:"12px 0"}}>
          <input aria-label="Search league logo queue" type="search" value={query} onChange={event=>{setQuery(event.target.value);setPage(0);}} placeholder="League or country…" style={{minHeight:44,flex:"1 1 180px"}} />
          <button type="button" className="btn dark" aria-pressed={onlyMissing} onClick={()=>{setOnlyMissing(value=>!value);setPage(0);}}>{onlyMissing?"Showing missing":"Showing all"}</button>
        </div>
        <div style={{display:"grid",gap:7}}>{visible.map(item=><button key={item.id} type="button" onClick={()=>choose(item)} style={{textAlign:"left",display:"flex",alignItems:"center",gap:14,padding:10,borderRadius:12,border:"1px solid var(--hc-card-border,var(--border))",background:item.id===selected?"var(--hc-card-surface,var(--surface))":"transparent",color:"var(--hc-foreground)",minHeight:62}}>
          <TeamLogo name={item.name} logoUrl={item.logo_url} size={38}/><span><strong>{item.name}</strong><small style={{display:"block"}}>{item.country||"Country unspecified"} · {item.logo_url?"URL on record":"No official logo URL yet"}</small></span>
        </button>)}</div>
        <div className="actions" style={{display:"flex",gap:10,marginTop:14}}>
          <button type="button" className="btn dark" disabled={page===0} onClick={()=>setPage(value=>value-1)}>Previous</button><span>Page {page+1} of {Math.max(1,Math.ceil(match.length/PAGE))}</span>
          <button type="button" className="btn dark" disabled={(page+1)*PAGE>=match.length} onClick={()=>setPage(value=>value+1)}>Next</button>
        </div>
      </section>
      {current && <section className="dashboard-card" style={{marginTop:16,display:"grid",gap:12}}>
        <h2>{current.name}</h2>
        <label>Official league logo image URL<input style={{width:"100%",minHeight:44}} type="url" value={logoUrl} onChange={event=>{setLogoUrl(event.target.value);setConfirmed(false);}} placeholder="https://official-source.example/logo.png" /></label>
        <label>Official league / rights evidence page<input style={{width:"100%",minHeight:44}} type="url" value={source} onChange={event=>{setSource(event.target.value);setConfirmed(false);}} placeholder="https://league.example/brand" /></label>
        <label style={{display:"flex",gap:8,alignItems:"flex-start"}}><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)} /><span>I verified the league identity, the official image source, and permission to display it on HoopCheck.</span></label>
        <p className="muted">Admin confirmation is a manual review, not proof of licensing. Do not submit fan-made or unrelated artwork.</p>
        <div className="actions"><button type="button" className="btn" disabled={working||!confirmed||!checkImageUrl(logoUrl)||!checkImageUrl(source)} onClick={()=>void save()}>{working?"Saving…":"Save verified logo"}</button>{current.logo_url&&<button type="button" className="btn dark" disabled={working} onClick={()=>void revert()}>Restore fallback</button>}</div>
      </section>}
    </>}
  </div></main>;
}
