"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";

type LinkItem={href:string;label:string;description:string};
type Experience={title:string;subtitle:string;links:LinkItem[]};
type Accent="orange"|"blue"|"purple";
type CourtsidePrefs={title:string;accent:Accent;links:string[]};
const experiences:Record<string,Experience>={
  player:{title:"Player Courtside",subtitle:"Your career, teams, and connections.",links:[
    {href:"/profile",label:"My Profile",description:"Career Passport"},
    {href:"/teams",label:"Team Research",description:"Teams & reviews"},
    {href:"/messages",label:"HoopChat",description:"Conversations"},
    {href:"/live-games",label:"Live Games",description:"Games & chat"},
    {href:"/players",label:"Players",description:"Find athletes"},
    {href:"/leagues",label:"Leagues",description:"Explore leagues"},
    {href:"/account#team-review-checklist",label:"Team Reviews",description:"Review eligibility"},
    {href:"/hoopgroups",label:"HoopGroups",description:"Communities"},
  ]},
  fan:{title:"Fan Courtside",subtitle:"Your teams, games, and communities.",links:[
    {href:"/team-hub",label:"Fan HQ",description:"Your teams and games"},
    {href:"/live-games",label:"Live Games",description:"Scores & chats"},
    {href:"/team-hub/groups",label:"Fan Groups",description:"Club supporters"},
    {href:"/hoopgroups",label:"HoopGroups",description:"Communities"},
    {href:"/teams",label:"Discover Teams",description:"Follow clubs"},

    {href:"/leagues",label:"Leagues",description:"Browse leagues"},
    {href:"/notifications",label:"Alerts",description:"Your activity"},
  ]},
  coach:{title:"Coach Courtside",subtitle:"Your network and talent research.",links:[
    {href:"/players",label:"Players",description:"Discover talent"},
    {href:"/coaches",label:"Coaches",description:"Connect"},
    {href:"/leagues",label:"Leagues",description:"Research"},
    {href:"/messages",label:"Messages",description:"Conversations"},
    {href:"/teams",label:"Teams",description:"Club research"},
    {href:"/hoopgroups",label:"HoopGroups",description:"Communities"},
  ]},
  agent:{title:"Agent Courtside",subtitle:"Your scouting and placement workspace.",links:[
    {href:"/agents-hq",label:"Agent HQ",description:"Workspace"},
    {href:"/players",label:"Players",description:"Talent research"},
    {href:"/leagues",label:"Leagues",description:"Global leagues"},
    {href:"/messages",label:"HoopChat",description:"Requests"},
    {href:"/teams",label:"Teams",description:"Club research"},
    {href:"/hoopgroups",label:"HoopGroups",description:"Communities"},
  ]},
  club_admin:{title:"Team Courtside",subtitle:"Your club and supporter workspace.",links:[
    {href:"/team-dashboard",label:"Team HQ",description:"Manage club"},
    {href:"/team-hub/groups",label:"Fan Groups",description:"Club supporters"},
    {href:"/teams",label:"Team Directory",description:"Club profiles"},
    {href:"/notifications",label:"Alerts",description:"Messages & updates"},
    {href:"/live-games",label:"Live Games",description:"Scores & chat"},
    {href:"/hoopgroups",label:"HoopGroups",description:"Communities"},
  ]},
  admin:{title:"Owner Courtside",subtitle:"Your HoopCheck workspace.",links:[
    {href:"/admin",label:"Owner HQ",description:"Management"},
    {href:"/teams",label:"Teams",description:"Directory"},
    {href:"/players",label:"Players",description:"Profiles"},
    {href:"/notifications",label:"Alerts",description:"Updates"},
    {href:"/account",label:"Account",description:"Settings"},
    {href:"/hoopgroups",label:"HoopGroups",description:"Communities"},
  ]},
  creator:{title:"Creator Courtside",subtitle:"Your basketball content community.",links:[
    {href:"/feed",label:"HoopFeed",description:"Community feed"},
    {href:"/hoopgroups",label:"HoopGroups",description:"Communities"},
    {href:"/live-games",label:"Live Games",description:"Game discussions"},
    {href:"/messages",label:"HoopChat",description:"Messages"},
    {href:"/players",label:"Players",description:"Profiles"},
    {href:"/teams",label:"Teams",description:"Club pages"},
  ]},
  member:{title:"My Courtside",subtitle:"Your basketball world at a glance.",links:[
    {href:"/live-games",label:"Live Games",description:"Scores & chat"},
    {href:"/teams",label:"Teams",description:"Discover clubs"},
    {href:"/hoopgroups",label:"HoopGroups",description:"Communities"},
    {href:"/notifications",label:"Alerts",description:"Your updates"},
    {href:"/players",label:"Players",description:"Find athletes"},
    {href:"/leagues",label:"Leagues",description:"Browse leagues"},
  ]},
};
experiences.scout={...experiences.agent,title:"Scout Courtside",subtitle:"Your global scouting workspace."};
experiences.manager=experiences.club_admin;
experiences.team_manager=experiences.club_admin;
const accents:Accent[]=["orange","blue","purple"];
function normalizeRole(role:string|null|undefined){
  const key=(role||"member").toLowerCase();
  return Object.prototype.hasOwnProperty.call(experiences,key)?key:"member";
}
export function getRoleExperience(role:string|null|undefined):Experience {
  return experiences[normalizeRole(role)];
}
function defaults(role:string):CourtsidePrefs {
  const current=experiences[role]||experiences.member;
  return {title:current.title,accent:role==="agent"||role==="creator"||role==="admin"?"purple":role==="coach"||role==="scout"?"blue":"orange",links:current.links.slice(0,4).map(x=>x.href)};
}
function restore(raw:string|null,role:string):CourtsidePrefs {
  const standard=defaults(role),items=experiences[role].links;
  if(!raw)return standard;
  try{
    const value=JSON.parse(raw) as Partial<CourtsidePrefs>;
    const choices=Array.isArray(value.links)
      ? [...new Set(value.links.map(href=>href==="/notifications?tab=messages"?"/messages":role==="fan"&&href==="/fan-feed"?"/team-hub":href).filter((href):href is string=>typeof href==="string"&&items.some(item=>item.href===href)))].slice(0,4)
      : standard.links;
    return {
      title:typeof value.title==="string"?value.title.slice(0,34):standard.title,
      accent:accents.includes(value.accent as Accent)?value.accent as Accent:standard.accent,
      links:choices.length?choices:standard.links,
    };
  }catch{return standard;}
}

export default function RoleQuickLinks({role,compact=false,profileId}:{
  role:string|null|undefined;compact?:boolean;profileId?:string;
}){
  const activeRole=normalizeRole(role);
  const experience=getRoleExperience(activeRole);
  const identity=profileId?profileId+":"+activeRole:"";
  const [prefs,setPrefs]=useState<CourtsidePrefs>(()=>defaults("member"));
  const [loadedIdentity,setLoadedIdentity]=useState("");
  const [editing,setEditing]=useState(false);
  useEffect(()=>{
    if(!profileId)return;
    try{setPrefs(restore(window.localStorage.getItem("hc-courtside-v1:"+identity),activeRole));}
    catch{setPrefs(defaults(activeRole));}
    setLoadedIdentity(identity);
    setEditing(false);
  },[profileId,identity,activeRole]);
  useEffect(()=>{
    if(!identity||loadedIdentity!==identity)return;
    try{window.localStorage.setItem("hc-courtside-v1:"+identity,JSON.stringify(prefs));}
    catch{/* Safe fallback when private browsing prevents local storage. */}
  },[identity,loadedIdentity,prefs]);
  function toggle(href:string) {
    setPrefs(current=>{
      const active=current.links.includes(href);
      if(active&&current.links.length<=1 || !active&&current.links.length>=4)return current;
      return {...current,links:active?current.links.filter(item=>item!==href):[...current.links,href]};
    });
  }
  function move(href:string,direction:number){
    setPrefs(current=>{
      const links=[...current.links],from=links.indexOf(href),to=from+direction;
      if(from<0||to<0||to>=links.length)return current;
      [links[from],links[to]]=[links[to],links[from]];
      return {...current,links};
    });
  }
  if(profileId&&loadedIdentity!==identity)return null;
  const current=profileId?prefs:defaults(activeRole);
  const selected=current.links.map(href=>experience.links.find(link=>link.href===href)).filter((item):item is LinkItem=>Boolean(item));
  return <section className={"hc-role-quick-links"+(compact?" is-compact":"")} style={{"--hc-courtside-accent":current.accent==="blue"?"#2563eb":current.accent==="purple"?"#7c3aed":"#f65b21"} as CSSProperties} aria-label="Personalized courtside">
    <div className="hc-role-quick-links__heading">
      <div><p className="eyebrow">YOUR COURTSIDE</p><h2>{current.title.trim()||experience.title}</h2><p className="muted">{experience.subtitle}</p></div>
      {profileId&&<button type="button" aria-expanded={editing} aria-controls="hc-courtside-editor" onClick={()=>setEditing(value=>!value)}>{editing?"Done":"Customize"}</button>}
    </div>
    <nav className="hc-role-quick-links__grid" aria-label="Your courtside shortcuts">
      {selected.map(item=><Link key={item.href} href={item.href}><strong>{item.label}</strong><small>{item.description}</small></Link>)}
    </nav>
    {editing&&profileId&&<div id="hc-courtside-editor" className="hc-courtside-editor">
      <label>Courtside name<input value={prefs.title} maxLength={34} onChange={e=>setPrefs(current=>({...current,title:e.target.value}))} placeholder={experience.title}/></label>
      <fieldset><legend>Accent color</legend><div className="hc-courtside-colors">{accents.map(accent=><label key={accent}><input type="radio" name={"courtside-accent-"+identity} checked={prefs.accent===accent} onChange={()=>setPrefs(current=>({...current,accent}))}/>{accent}</label>)}</div></fieldset>
      <fieldset><legend>Shortcuts (choose 1–4, change order)</legend><div className="hc-courtside-options">{experience.links.map(item=>{
        const index=prefs.links.indexOf(item.href),checked=index>=0;
        return <div key={item.href} className="hc-courtside-option"><label><input type="checkbox" checked={checked} disabled={checked?prefs.links.length<=1:prefs.links.length>=4} onChange={()=>toggle(item.href)}/>{item.label}</label>{checked&&<div><button type="button" aria-label={"Move "+item.label+" earlier"} disabled={index===0} onClick={()=>move(item.href,-1)}>↑</button><button type="button" aria-label={"Move "+item.label+" later"} disabled={index===prefs.links.length-1} onClick={()=>move(item.href,1)}>↓</button></div>}</div>;
      })}</div></fieldset>
      <div className="hc-courtside-editor-footer"><small>Saved for this account on this device.</small><button type="button" onClick={()=>setPrefs(defaults(activeRole))}>Reset</button></div>
    </div>}
  </section>;
}
