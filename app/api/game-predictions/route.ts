import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
const finalStatuses = new Set(["final", "finished"]);
const liveStatuses = new Set(["live", "in_progress"]);

function clients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) throw new Error("Game predictions are not configured.");
  return {
    auth: createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } }),
    db: createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } }),
  };
}
async function currentUser(request: Request, auth: ReturnType<typeof createClient>) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\\s+/i, "") || "";
  if (!token) return null;
  const { data } = await auth.auth.getUser(token);
  return data.user || null;
}
function winner(game: any) {
  if (!finalStatuses.has(String(game.status).toLowerCase())) return null;
  if (game.home_score == null || game.away_score == null || Number(game.home_score) === Number(game.away_score)) return null;
  return Number(game.home_score) > Number(game.away_score) ? game.team_id : game.opponent_team_id;
}

export async function GET(request: Request) {
  try {
    const { auth, db } = clients();
    const user = await currentUser(request, auth);
    if (!user) return NextResponse.json({ error: "Sign in to view predictions." }, { status: 401 });
    const url = new URL(request.url);
    if (url.searchParams.get("mode") === "leaderboard") {
      const [{ data: games, error: gamesError }, { data: picks, error: picksError }] = await Promise.all([
        db.from("fan_live_games").select("id,team_id,opponent_team_id,opponent_name,status,home_score,away_score,scheduled_at,ends_at").in("status", ["final", "finished"]).order("ends_at", { ascending: false }).limit(100),
        db.from("game_winner_picks").select("game_id,user_id,picked_team_id"),
      ]);
      if (gamesError || picksError) throw gamesError || picksError;
      const completed = (games || []).filter((g:any) => winner(g));
      const completedIds = new Set(completed.map((g:any)=>g.id));
      const correct = (picks || []).filter((p:any)=>completedIds.has(p.game_id) && p.picked_team_id === winner(completed.find((g:any)=>g.id===p.game_id)));
      const score = new Map<string,number>();
      for (const p of correct) score.set(p.user_id,(score.get(p.user_id)||0)+1);
      const rankedIds = Array.from(score.keys()).sort((a,b)=>(score.get(b)||0)-(score.get(a)||0)).slice(0,20);
      const allIds = Array.from(new Set([user.id,...rankedIds,...correct.map((p:any)=>p.user_id)]));
      const { data: profiles } = allIds.length ? await db.from("profiles").select("id,display_name").in("id",allIds) : {data:[] as any[]};
      const names = new Map((profiles||[]).map((p:any)=>[p.id,p.display_name||"HoopCheck member"]));
      const overall = rankedIds.map((id,index)=>({rank:index+1,user_id:id,display_name:names.get(id)||"HoopCheck member",correct_picks:score.get(id)||0}));
      const perGame = completed.slice(0,20).map((g:any)=>{
        const gameCorrect = correct.filter((p:any)=>p.game_id===g.id);
        const userCounts = new Map<string,number>();
        for(const p of gameCorrect) userCounts.set(p.user_id,(userCounts.get(p.user_id)||0)+1);
        const ranked = Array.from(userCounts.keys()).sort((a,b)=>(userCounts.get(b)||0)-(userCounts.get(a)||0)).slice(0,5)
          .map((id,index)=>({rank:index+1,user_id:id,display_name:names.get(id)||"HoopCheck member",correct_picks:userCounts.get(id)||0}));
        return {game_id:g.id,home_team_id:g.team_id,away_team_id:g.opponent_team_id,opponent_name:g.opponent_name,home_score:g.home_score,away_score:g.away_score,winner_team_id:winner(g),my_pick:(picks||[]).find((p:any)=>p.game_id===g.id&&p.user_id===user.id)?.picked_team_id||null,leaderboard:ranked};
      });
      return NextResponse.json({leaderboard:overall,games:perGame},{headers:{"Cache-Control":"private, no-store"}});
    }
    const gameId = url.searchParams.get("gameId") || "";
    if (!/^[0-9a-f-]{36}$/i.test(gameId)) return NextResponse.json({error:"Provide a valid game."},{status:400});
    const [{data:game,error:gameError},{data:mine,error:mineError},{data:picks,error:picksError}] = await Promise.all([
      db.from("fan_live_games").select("id,team_id,opponent_team_id,opponent_name,status,home_score,away_score,scheduled_at,ends_at").eq("id",gameId).maybeSingle(),
      db.from("game_winner_picks").select("picked_team_id").eq("game_id",gameId).eq("user_id",user.id).maybeSingle(),
      db.from("game_winner_picks").select("picked_team_id").eq("game_id",gameId),
    ]);
    if(gameError||mineError||picksError) throw gameError||mineError||picksError;
    if(!game) return NextResponse.json({error:"Game not found."},{status:404});
    const status=String(game.status).toLowerCase();
    const tip=Date.parse(game.scheduled_at||"");
    const locked=finalStatuses.has(status)||liveStatuses.has(status)||(Number.isFinite(tip)&&Date.now()>=tip);
    const winnerId=winner(game), total=(picks||[]).length;
    const winnerCount=winnerId?(picks||[]).filter((p:any)=>p.picked_team_id===winnerId).length:0;
    const results=finalStatuses.has(status)&&winnerId?{winner_team_id:winnerId,total_picks:total,winner_percent:total?Math.round(winnerCount/total*100):0,correct_picks:winnerCount}:null;
    return NextResponse.json({game,my_pick:mine?.picked_team_id||null,locked,total_picks:total,results},{headers:{"Cache-Control":"private, no-store"}});
  } catch(error) {
    console.error("Game prediction GET failed",error);
    return NextResponse.json({error:"Predictions could not be loaded."},{status:500});
  }
}

export async function POST(request: Request) {
  try {
    const {auth,db}=clients();
    const user=await currentUser(request,auth);
    if(!user) return NextResponse.json({error:"Sign in to make a pick."},{status:401});
    const body=await request.json();
    const gameId=typeof body.gameId==="string"?body.gameId:"";
    const pickedTeamId=typeof body.pickedTeamId==="string"?body.pickedTeamId:"";
    if(!/^[0-9a-f-]{36}$/i.test(gameId)||!/^[0-9a-f-]{36}$/i.test(pickedTeamId)) return NextResponse.json({error:"Choose one of the teams."},{status:400});
    const [{data:profile},{data:game,error:gameError}]=await Promise.all([
      db.from("profiles").select("account_type").eq("id",user.id).maybeSingle(),
      db.from("fan_live_games").select("id,team_id,opponent_team_id,status,scheduled_at").eq("id",gameId).maybeSingle(),
    ]);
    if(!["fan","player"].includes(profile?.account_type||"")) return NextResponse.json({error:"Predictions are available to fans and players."},{status:403});
    if(gameError||!game) return NextResponse.json({error:"Game not found."},{status:404});
    if(!game.opponent_team_id||![game.team_id,game.opponent_team_id].includes(pickedTeamId)) return NextResponse.json({error:"Pick one of the listed teams."},{status:400});
    const tip=Date.parse(game.scheduled_at||"");
    if(["final","finished","live","in_progress"].includes(String(game.status).toLowerCase())||!Number.isFinite(tip)||Date.now()>=tip) return NextResponse.json({error:"Picks are locked at tip-off."},{status:409});
    const {error}=await db.from("game_winner_picks").upsert({game_id:gameId,user_id:user.id,picked_team_id:pickedTeamId,updated_at:new Date().toISOString()},{onConflict:"game_id,user_id"});
    if(error) throw error;
    return NextResponse.json({ok:true,picked_team_id:pickedTeamId});
  } catch(error) {
    console.error("Game prediction POST failed",error);
    return NextResponse.json({error:"Your pick could not be saved."},{status:500});
  }
}