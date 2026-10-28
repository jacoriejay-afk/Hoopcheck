"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Game = { id:string; team_id:string; opponent_team_id:string|null; opponent_name:string; status:string; home_score:number|null; away_score:number|null; scheduled_at:string|null };
type Prediction = { my_pick:string|null; locked:boolean; total_picks:number; results:{winner_team_id:string;total_picks:number;winner_percent:number;correct_picks:number}|null };
export default function GameWinnerPrediction({game,homeName,awayName}:{game:Game;homeName:string;awayName:string}) {
 const [data,setData]=useState<Prediction|null>(null); const [busy,setBusy]=useState(false); const [notice,setNotice]=useState("");
 const token=useCallback(async()=>{const {data:{session}}=await supabase.auth.getSession();return session?.access_token||"";},[]);
 const refresh=useCallback(async()=>{const t=await token();const res=await fetch("/api/game-predictions?gameId="+encodeURIComponent(game.id),{headers:{Authorization:"Bearer "+t},cache:"no-store"});const json=await res.json();if(res.ok)setData(json);},[game.id,token]);
 useEffect(()=>{void refresh();const timer=window.setInterval(()=>void refresh(),15000);return()=>window.clearInterval(timer);},[refresh]);
 async function pick(teamId:string){if(!data||data.locked||busy)return;setBusy(true);setNotice("");const t=await token();const res=await fetch("/api/game-predictions",{method:"POST",headers:{Authorization:"Bearer "+t,"Content-Type":"application/json"},body:JSON.stringify({gameId:game.id,pickedTeamId:teamId})});const json=await res.json();setBusy(false);if(!res.ok){setNotice(json.error||"Pick could not be saved.");void refresh();return;}setNotice("Pick saved. You can change it until tip-off.");await refresh();}
 if(!data)return <section className="hc-prediction"><strong>Pick the winner</strong><p>Loading picks…</p></section>;
 return <section className="hc-prediction" aria-label="Game winner prediction"><div className="hc-prediction-head"><div><span className="hc-prediction-kicker">GAME PREDICTION</span><h3>{data.locked?"Picks locked":"Who wins?"}</h3></div><span className={"hc-prediction-state"+(data.locked?" is-locked":"")}>{data.locked?"LOCKED":"OPEN"}</span></div>
 <p className="hc-prediction-hint">{data.locked?"Picks locked at scheduled tip-off.": "One tap to pick. You can change your mind until tip-off."}</p>
 <div className="hc-prediction-options">{[{id:game.team_id,name:homeName},{id:game.opponent_team_id,name:awayName}].filter((x):x is {id:string;name:string}=>Boolean(x.id)).map(team=><button key={team.id} type="button" disabled={data.locked||busy} aria-pressed={data.my_pick===team.id} className={"hc-prediction-option"+(data.my_pick===team.id?" is-picked":"")} onClick={()=>void pick(team.id)}><span>{team.name}</span><strong>{data.my_pick===team.id?"✓ YOUR PICK":"PICK WINNER"}</strong></button>)}</div>
 {data.locked&&data.results&&<div className="hc-prediction-results"><strong>{data.results.winner_percent}% picked the winner</strong><span>{data.results.total_picks} total picks · {data.results.correct_picks} correct</span></div>}
 {notice&&<p role="status" className="hc-prediction-notice">{notice}</p>}
 </section>;
}