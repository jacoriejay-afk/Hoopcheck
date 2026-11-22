"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { HoopIcon, type HoopIconName } from "../../components/HoopCheckUI";
import "./home-court-space.css";

type ActionId = "hoopgroups" | "live" | "hoopfeed" | "teams" | "players" | "search" | "fans" | "alerts" | "account" | "messages" | "leagues" | "coaches" | "team_hq" | "agent_hq";
type Accent = "orange" | "blue" | "purple";
type CourtPrefs = { name:string; accent:Accent; featured:ActionId; actions:ActionId[] };
type Action = { id:ActionId; label:string; detail:string; href:string; icon:HoopIconName };
const ACTIONS:Action[] = [
  {id:"hoopgroups",label:"HoopGroups",detail:"Basketball communities and conversations",href:"/hoopgroups",icon:"users"},
  {id:"live",label:"Live Games",detail:"Watch and discuss basketball",href:"/live-games",icon:"basketball"},
  {id:"hoopfeed",label:"HoopFeed",detail:"Explore the basketball community",href:"/feed",icon:"message-square"},
  {id:"teams",label:"Check a Team",detail:"Research clubs and reviews",href:"/teams",icon:"shield-check"},
  {id:"players",label:"Find Players",detail:"Discover player profiles",href:"/players",icon:"user"},
  {id:"search",label:"Search",detail:"Search the basketball world",href:"/search",icon:"search"},
  {id:"fans",label:"Fan Groups",detail:"Follow your club communities",href:"/team-hub/groups",icon:"users"},
  {id:"alerts",label:"Alerts",detail:"See your updates",href:"/notifications",icon:"bell"},
  {id:"account",label:"My Account",detail:"Manage your profile",href:"/account",icon:"settings"},
  {id:"messages",label:"HoopChat",detail:"Your messages and requests",href:"/notifications?tab=messages",icon:"message-square"},
  {id:"leagues",label:"Leagues",detail:"Browse worldwide leagues",href:"/leagues",icon:"basketball"},
  {id:"coaches",label:"Coaches",detail:"Connect with coaches",href:"/coaches",icon:"users"},
  {id:"team_hq",label:"Team HQ",detail:"Manage your club",href:"/team-dashboard",icon:"shield-check"},
  {id:"agent_hq",label:"Agent HQ",detail:"Your professional workspace",href:"/agents-hq",icon:"user"},
];
const ACTION_MAP = new Map(ACTIONS.map(action=>[action.id,action]));
const allowed = new Set<ActionId>(ACTIONS.map(action=>action.id));
const accents:Accent[] = ["orange","blue","purple"];
type Preset = {accent:Accent;featured:ActionId;actions:ActionId[]};
const presets:Record<string,Preset> = {
  player:{accent:"orange",featured:"hoopgroups",actions:["live","hoopfeed","teams","players"]},
  fan:{accent:"orange",featured:"live",actions:["hoopgroups","fans","teams","alerts"]},
  coach:{accent:"blue",featured:"players",actions:["teams","coaches","leagues","messages"]},
  agent:{accent:"purple",featured:"players",actions:["agent_hq","teams","leagues","messages"]},
  scout:{accent:"blue",featured:"players",actions:["teams","leagues","search","messages"]},
  club_admin:{accent:"orange",featured:"team_hq",actions:["teams","fans","live","alerts"]},
  admin:{accent:"purple",featured:"account",actions:["team_hq","teams","players","alerts"]},
  creator:{accent:"purple",featured:"hoopfeed",actions:["live","players","messages","hoopgroups"]},
  member:{accent:"orange",featured:"live",actions:["hoopgroups","teams","search","alerts"]},
};
function roleKey(role:string|null|undefined):string {
  const key=(role||"member").toLowerCase();
  if(key==="manager"||key==="team_manager") return "club_admin";
  return Object.prototype.hasOwnProperty.call(presets,key) ? key : "member";
}
function actionAllowedForRole(role:string,id:ActionId):boolean {
  if(id==="team_hq") return role==="club_admin"||role==="admin";
  if(id==="agent_hq") return role==="agent"||role==="scout"||role==="admin";
  return true;
}
function defaults(role:string):CourtPrefs {
  const preset=presets[role]||presets.member;
  return {name:"My Court",accent:preset.accent,featured:preset.featured,actions:[...preset.actions]};
}
function restore(raw:string|null,fallback:CourtPrefs):CourtPrefs {
  if(!raw) return fallback;
  try {
    const input:unknown=JSON.parse(raw);
    if(!input||typeof input!=="object") return fallback;
    const value=input as Partial<CourtPrefs>;
    const featured=typeof value.featured==="string"&&allowed.has(value.featured as ActionId)?value.featured as ActionId:fallback.featured;
    const chosen=Array.isArray(value.actions)
      ? [...new Set(value.actions.filter((id):id is ActionId=>typeof id==="string"&&allowed.has(id as ActionId)&&id!==featured))].slice(0,6)
      : fallback.actions;
    return {
      name:typeof value.name==="string"?value.name.slice(0,36):fallback.name,
      accent:accents.includes(value.accent as Accent)?value.accent as Accent:fallback.accent,
      featured,
      actions:chosen.length?chosen:fallback.actions.filter(id=>id!==featured),
    };
  } catch {return fallback;}
}
const spanishLabels:Partial<Record<ActionId,string>>={
  hoopgroups:"HoopGroups",live:"Partidos",hoopfeed:"HoopFeed",teams:"Consultar un equipo",
  players:"Jugadores",search:"Buscar",fans:"Grupos de fans",alerts:"Alertas",
  account:"Mi cuenta",messages:"HoopChat",leagues:"Ligas",coaches:"Entrenadores",
  team_hq:"Equipo HQ",agent_hq:"Agente HQ",
};
function destination(id:ActionId,hasFeedAccess:boolean){
  const item=ACTION_MAP.get(id);
  return id==="hoopfeed"&&!hasFeedAccess?"/membership":item?.href||"/dashboard";
}

export default function HomeCourtSpace({profileId,role,hasFeedAccess,language}:{
  profileId:string;role?:string|null;hasFeedAccess:boolean;language:string;
}) {
  const spanish=language==="es";
  const activeRole=roleKey(role);
  const identity=profileId?profileId+":"+activeRole:"";
  const [prefs,setPrefs]=useState<CourtPrefs>(()=>defaults("member"));
  const [loadedIdentity,setLoadedIdentity]=useState("");
  const [editing,setEditing]=useState(false);
  useEffect(()=>{
    if(!profileId){setLoadedIdentity("");setEditing(false);return;}
    const base=defaults(activeRole);
    try{
      const stored=window.localStorage.getItem("hc-court-v2:"+identity)
        ||window.localStorage.getItem("hc-court-v1:"+profileId);
      const saved=restore(stored,base);
      const featured=actionAllowedForRole(activeRole,saved.featured)?saved.featured:base.featured;
      const actions=saved.actions.filter(id=>actionAllowedForRole(activeRole,id)&&id!==featured);
      setPrefs({...saved,featured,actions:actions.length?actions:base.actions.filter(id=>id!==featured)});
    }catch{setPrefs(base);}
    setEditing(false);
    setLoadedIdentity(identity);
  },[activeRole,identity,profileId]);
  useEffect(()=>{
    // Persist only after this specific authenticated user and role have restored.
    if(!identity||loadedIdentity!==identity)return;
    try{window.localStorage.setItem("hc-court-v2:"+identity,JSON.stringify(prefs));}
    catch{/* Retain the current session's preferences when storage is disabled. */}
  },[identity,loadedIdentity,prefs]);

  function toggle(id:ActionId){
    setPrefs(current=>{
      if(current.featured===id) return current;
      const exists=current.actions.includes(id);
      if(!exists&&current.actions.length>=6)return current;
      if(exists&&current.actions.length<=1)return current;
      return {...current,actions:exists?current.actions.filter(item=>item!==id):[...current.actions,id]};
    });
  }
  function move(id:ActionId,offset:number){
    setPrefs(current=>{
      const actions=[...current.actions];
      const from=actions.indexOf(id),to=from+offset;
      if(from<0||to<0||to>=actions.length)return current;
      [actions[from],actions[to]]=[actions[to],actions[from]];
      return {...current,actions};
    });
  }
  function feature(id:ActionId){
    setPrefs(current=>{
      if(current.featured===id)return current;
      const actions=current.actions.filter(item=>item!==id);
      if(actions.length<6)actions.unshift(current.featured);
      return {...current,featured:id,actions};
    });
  }
  const roleActions=ACTIONS.filter(action=>actionAllowedForRole(activeRole,action.id));
  const selected=prefs.actions.filter(id=>actionAllowedForRole(activeRole,id)).map(id=>ACTION_MAP.get(id)).filter((a):a is Action=>!!a);
  const featured=ACTION_MAP.get(prefs.featured)||ACTIONS[0];
  if(!profileId||loadedIdentity!==identity)return null;
  return <section className="hc-my-court" style={{"--hc-court-accent":prefs.accent==="blue"?"#2563eb":prefs.accent==="purple"?"#7c3aed":"#f65b21"} as CSSProperties} aria-label="Your personalized court space">
    <header className="hc-court-head">
      <div><span className="hc-court-kicker">{activeRole.replace("_"," ").toUpperCase()} COURT SPACE</span><h2>{prefs.name.trim()||"My Court"}</h2></div>
      <button type="button" onClick={()=>setEditing(value=>!value)} aria-expanded={editing} aria-controls="hc-court-editor">
        <HoopIcon name={editing?"x":"settings"} size={16}/>{editing?"Done":"Customize"}
      </button>
    </header>
    <Link href={destination(featured.id,hasFeedAccess)} className="hc-court-feature">
      <span className="hc-court-feature-icon"><HoopIcon name={featured.icon} size={23}/></span>
      <span><strong>{featured.id==="hoopfeed"&&!hasFeedAccess?"Unlock HoopFeed":featured.label}</strong><small>{featured.detail}</small></span>
      <HoopIcon name="arrow-right" size={19}/>
    </Link>
    <div className="hc-court-quick-heading"><h2>{spanish?"ACCIONES RÁPIDAS":"QUICK ACTIONS"}</h2><small>{selected.length} {spanish?"fijados":"pinned"}</small></div>
    <nav className="hc-court-actions" aria-label="My Court quick actions">
      {selected.map(action=><Link key={action.id} href={destination(action.id,hasFeedAccess)} title={action.label}>
        <HoopIcon name={action.icon} size={21}/><span>{action.id==="hoopfeed"&&!hasFeedAccess?"Unlock HoopFeed":spanish?(spanishLabels[action.id]??action.label):action.label}</span>
      </Link>)}
    </nav>
    {editing&&<div id="hc-court-editor" className="hc-court-editor" aria-label="Customize My Court">
      <label>Rename your court<input type="text" autoComplete="off" maxLength={36} value={prefs.name} onChange={e=>setPrefs(current=>({...current,name:e.target.value}))} placeholder="My Court"/></label>
      <fieldset><legend>Accent color</legend><div className="hc-court-color-choices">{accents.map(accent=><label key={accent}><input type="radio" name={"court-accent-"+identity} value={accent} checked={prefs.accent===accent} onChange={()=>setPrefs(current=>({...current,accent}))}/><span className={"hc-court-swatch hc-court-swatch--"+accent}/>{accent}</label>)}</div></fieldset>
      <fieldset><legend>Featured shortcut</legend><p className="hc-court-help">Choose what opens from the main court card.</p><select aria-label="Featured shortcut" className="hc-court-feature-select" value={prefs.featured} onChange={event=>feature(event.target.value as ActionId)}>{roleActions.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</select></fieldset>
      <fieldset><legend>Quick actions (choose 1–6, change order)</legend><div className="hc-court-options">{roleActions.filter(a=>a.id!==prefs.featured).map(action=>{
        const index=prefs.actions.indexOf(action.id),active=index>=0;
        return <div className="hc-court-option" key={action.id}>
          <label><input type="checkbox" checked={active} disabled={active?prefs.actions.length<=1:prefs.actions.length>=6} onChange={()=>toggle(action.id)}/>{action.label}</label>
          {active&&<div><button type="button" aria-label={"Move "+action.label+" earlier"} disabled={index===0} onClick={()=>move(action.id,-1)}>↑</button><button type="button" aria-label={"Move "+action.label+" later"} disabled={index===prefs.actions.length-1} onClick={()=>move(action.id,1)}>↓</button></div>}
        </div>;
      })}</div></fieldset>
      <div className="hc-court-editor-footer"><small>Saved on this device, separately for each signed-in account and role.</small><button type="button" onClick={()=>setPrefs(defaults(activeRole))}>Reset Court</button></div>
    </div>}
  </section>;
}
