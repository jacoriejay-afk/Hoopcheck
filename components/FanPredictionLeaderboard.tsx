"use client";
import { useCallback,useEffect,useState } from "react";
import { supabase } from "../lib/supabase";
type GameRow={game_id:string;home_team_id:string;away_team_id:string|null;opponent_name:string;home_score:number|null;away_score:number|null;winner_team_id:string;my_pick:string|null;leaderboard:{rank:number;user_id:string;display_name:string;correct_picks:number}[]};
export default function FanPredictionLeaderboard(){
 const [games,setGames]=useState<GameRow[]>([]);const [loading,setLoading]=useState(true);const [notice,setNotice]=useState("");
 const load=useCallback(async()=>{const {data:{session}}=await supabase.auth.getSession();if(!session){setLoading(false);return;}const res=await fetch("/api/game-predictions?mode=leaderboard",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});const json=await res.json();if(res.ok)setGames(json.games||[]);else setNotice(json.error||"Leaderboard unavailable.");setLoading(false);},[]);
 useEffect(()=>{void load();},[load]);
 return <section className="dashboard-card hc-prediction-leaderboard"><div className="hc-prediction-head"><div><span className="hc-prediction-kicker">GAME PICKS</span><h2>Correct-picks leaderboard</h2></div><span className="hc-prediction-state">PER GAME</span></div><p className="muted">See who called each final result. Predictions do not affect reviews or membership access.</p>
 {loading?<p className="muted">Loading results…</p>:notice?<p role="status">{notice}</p>:!games.length?<p className="muted">Completed games with settled picks will appear here.</p>:games.map(g=><article key={g.game_id} className="hc-prediction-leaderboard-game"><div className="hc-prediction-leaderboard-score"><strong>{g.home_score} – {g.away_score}</strong><span>{g.my_pick===g.winner_team_id?"✓ Your pick was correct":g.my_pick?"Your pick missed":"No pick submitted"}</span></div>{g.leaderboard.length?<ol>{g.leaderboard.map(p=><li key={p.user_id}><span><b>{p.rank}.</b> {p.display_name}</span><strong>{p.correct_picks} correct</strong></li>)}</ol>:<p className="muted">No correct picks recorded.</p>}</article>)}
 </section>;
}