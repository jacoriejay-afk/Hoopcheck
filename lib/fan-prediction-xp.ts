export const FAN_XP_WINDOW_DAYS = 90;
export const FAN_XP_PER_CORRECT_PICK = 10;
export const FAN_LEVELS = [
  {name:"Rookie",xp:0},
  {name:"Starter",xp:50},
  {name:"All-Star",xp:150},
  {name:"MVP",xp:300},
  {name:"Legend",xp:600},
] as const;

type Pick={game_id:string;picked_team_id:string;updated_at:string|null};
type SettledGame={id:string;team_id:string;opponent_team_id:string;winner_team_id:string;scheduled_at:string|null;ends_at:string|null};

/** Non-redeemable activity score, calculated from server-validated picks. No client writes. */
export function calculateFanPredictionXp(picks:Pick[],games:SettledGame[],now:Date) {
  const cutoff=now.getTime()-FAN_XP_WINDOW_DAYS*86400000;
  const gameMap=new Map(games.map(g=>[g.id,g]));
  const seen=new Set<string>();
  let settled=0,correct=0;
  for(const pick of picks){
    const g=gameMap.get(pick.game_id);
    if(!g||seen.has(g.id))continue;
    const tip=Date.parse(g.scheduled_at||""),end=Date.parse(g.ends_at||""),submitted=Date.parse(pick.updated_at||"");
    if(!Number.isFinite(tip)||!Number.isFinite(end)||!Number.isFinite(submitted)||
      submitted<cutoff||submitted>=tip||end<tip||end>now.getTime()||
      ![g.team_id,g.opponent_team_id].includes(pick.picked_team_id)||
      ![g.team_id,g.opponent_team_id].includes(g.winner_team_id)||g.team_id===g.opponent_team_id)continue;
    seen.add(g.id);settled++;
    if(pick.picked_team_id===g.winner_team_id)correct++;
  }
  const xp=correct*FAN_XP_PER_CORRECT_PICK;
  const index=FAN_LEVELS.reduce((best,l,i)=>xp>=l.xp?i:best,0);
  const next=FAN_LEVELS[index+1];
  return {xp,level:FAN_LEVELS[index].name,next_level:next?.name??null,next_level_xp:next?.xp??null,correct_picks:correct,settled_picks:settled,window_days:FAN_XP_WINDOW_DAYS};
}
