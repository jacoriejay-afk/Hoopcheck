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
type SettledGame={id:string;team_id:string;opponent_team_id:string;winner_team_id:string;scheduled_at:string|null;ends_at:string|null;country?:string|null;league_name?:string|null};

const cleanLabel=(value:string|null|undefined)=>typeof value==="string"?value.trim().slice(0,120):"";
export const FAN_MILESTONES=[{id:"first-pick",name:"First settled pick",count:1,metric:"settled"},{id:"five-correct",name:"Five correct picks",count:5,metric:"correct"},{id:"international",name:"Three fixture countries",count:3,metric:"countries"},{id:"league-explorer",name:"Five fixture leagues",count:5,metric:"leagues"}] as const;

/** Non-redeemable activity score, calculated from server-validated picks. No client writes. */
export function calculateFanPredictionXp(picks:Pick[],games:SettledGame[],now:Date) {
  const cutoff=now.getTime()-FAN_XP_WINDOW_DAYS*86400000;
  const gameMap=new Map(games.map(g=>[g.id,g]));
  const seen=new Set<string>();
  let settled=0,correct=0;
  const countries=new Map<string,string>();
  const leagues=new Set<string>();
  const entries:{game_id:string;settled_at:string;country:string|null;league:string|null;correct:boolean}[]=[];
  for(const pick of picks){
    const g=gameMap.get(pick.game_id);
    if(!g||seen.has(g.id))continue;
    const tip=Date.parse(g.scheduled_at||""),end=Date.parse(g.ends_at||""),submitted=Date.parse(pick.updated_at||"");
    if(!Number.isFinite(tip)||!Number.isFinite(end)||!Number.isFinite(submitted)||
      submitted<cutoff||submitted>=tip||end<tip||end>now.getTime()||
      ![g.team_id,g.opponent_team_id].includes(pick.picked_team_id)||
      ![g.team_id,g.opponent_team_id].includes(g.winner_team_id)||g.team_id===g.opponent_team_id)continue;
    seen.add(g.id);settled++;
    const hit=pick.picked_team_id===g.winner_team_id;
    if(hit)correct++;
    const country=cleanLabel(g.country),league=cleanLabel(g.league_name);
    if(country&&!countries.has(country.toLowerCase()))countries.set(country.toLowerCase(),country);
    if(league)leagues.add(JSON.stringify([country.toLowerCase(),league.toLowerCase()]));
    entries.push({game_id:g.id,settled_at:new Date(end).toISOString(),country:country||null,league:league||null,correct:hit});
  }
  const xp=correct*FAN_XP_PER_CORRECT_PICK;
  const index=FAN_LEVELS.reduce((best,l,i)=>xp>=l.xp?i:best,0);
  const next=FAN_LEVELS[index+1];
  const metrics={settled,correct,countries:countries.size,leagues:leagues.size};
  const passport={
    countries:Array.from(countries.values()).sort(),
    league_count:leagues.size,
    recent:entries.sort((a,b)=>b.settled_at.localeCompare(a.settled_at)||a.game_id.localeCompare(b.game_id)).slice(0,12),
    milestones:FAN_MILESTONES.map(m=>({id:m.id,name:m.name,earned:metrics[m.metric]>=m.count,current:Math.min(metrics[m.metric],m.count),target:m.count})),
  };
  return {passport,xp,level:FAN_LEVELS[index].name,next_level:next?.name??null,next_level_xp:next?.xp??null,correct_picks:correct,settled_picks:settled,window_days:FAN_XP_WINDOW_DAYS};
}

export const FAN_RANK_WINDOW_DAYS=7;
export const FAN_RANK_MIN_PARTICIPANTS=10;

/** Private comparison, with no participant names or IDs in the returned payload. */
export function calculateFanPredictionRank(picks:(Pick&{user_id:string})[],games:SettledGame[],fanIds:ReadonlySet<string>,callerId:string,now:Date){
  const cutoff=now.getTime()-FAN_RANK_WINDOW_DAYS*86400000;
  const grouped=new Map<string,Pick[]>();
  for(const pick of picks){
    const submitted=Date.parse(pick.updated_at||"");
    if(!fanIds.has(pick.user_id)||!Number.isFinite(submitted)||submitted<cutoff||submitted>now.getTime())continue;
    const group=grouped.get(pick.user_id)||[];
    group.push(pick);
    grouped.set(pick.user_id,group);
  }
  const scores=new Map<string,number>();
  for(const [id,group] of grouped){
    const result=calculateFanPredictionXp(group,games,now);
    if(result.settled_picks>0)scores.set(id,result.correct_picks);
  }
  const own=scores.get(callerId);
  const enough=scores.size>=FAN_RANK_MIN_PARTICIPANTS;
  return {
    window_days:FAN_RANK_WINDOW_DAYS,
    minimum_participants:FAN_RANK_MIN_PARTICIPANTS,
    status:!enough?"insufficient-participation":own===undefined?"no-settled-picks":"ranked",
    rank:enough&&own!==undefined?1+Array.from(scores.values()).filter(score=>score>own).length:null,
    participants:enough?scores.size:null,
    correct_picks:own??null,
  };
}
