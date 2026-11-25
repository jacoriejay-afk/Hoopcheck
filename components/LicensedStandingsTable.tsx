"use client";
import { useEffect,useState } from "react";
import type { licensedStandingsView } from "../lib/hoopdata-licensed-standings";
type View=NonNullable<ReturnType<typeof licensedStandingsView>>;
export default function LicensedStandingsTable({view}:{view:View}){
 const [current,setCurrent]=useState(()=>Date.parse(view.expiresAt)>Date.now());
 useEffect(()=>{
  const check=()=>setCurrent(Date.parse(view.expiresAt)>Date.now());
  check();
  const timer=setTimeout(check,Math.max(0,Date.parse(view.expiresAt)-Date.now()));
  window.addEventListener("pageshow",check);
  document.addEventListener("visibilitychange",check);
  return()=>{clearTimeout(timer);window.removeEventListener("pageshow",check);document.removeEventListener("visibilitychange",check);};
 },[view.expiresAt]);
 if(!current)return <p role="status">Standings have expired. Refresh to check for a verified update.</p>;
 return <section className="card" aria-label="Official league standings">
  <h2>Official standings</h2>
  <p>Season {view.season} · Source: {view.source}</p>
  {view.attribution?<p>{view.attribution}</p>:null}
  <p className="muted">Observed <time dateTime={view.observedAt}>{new Date(view.observedAt).toISOString().replace("T"," ").slice(0,16)} UTC</time>. Unreported statistics are shown as —.</p>
  {view.groups.map(g=><section key={JSON.stringify([g.stage,g.group])}>
    <h3>{[g.stage,g.group].filter(Boolean).join(" · ")||"Competition table"}</h3>
    <div style={{overflowX:"auto"}} tabIndex={0} role="region" aria-label="Scrollable standings table">
     <table style={{width:"100%",borderCollapse:"collapse",textAlign:"left",fontVariantNumeric:"tabular-nums"}}>
      <thead><tr>{["Rank","Team","Played","Wins","Losses","Points for","Points against"].map(h=><th scope="col" key={h} style={{padding:8}}>{h}</th>)}</tr></thead>
      <tbody>{g.rows.map(r=><tr key={r.teamId}><td style={{padding:8}}>{r.position}</td><th scope="row" style={{padding:8}}>{r.name}</th>{[r.played,r.wins,r.losses,r.pointsFor,r.pointsAgainst].map((v,i)=><td key={i} style={{padding:8}}>{v??"—"}</td>)}</tr>)}</tbody>
     </table>
    </div>
  </section>)}
 </section>;
}
