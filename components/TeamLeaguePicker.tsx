"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Gender = "mens" | "womens";
type TeamRow = { id:string; name:string; country:string|null; city:string|null; league_name:string|null; league_id?:string|null; basketball_type?:string|null; created_at?:string|null; source?:"teams"|"womens_teams" };
type LeagueRow = { id:string; name:string; country:string|null; basketball_type?:string|null };
type MembershipRow = { team_id:string; league_id:string; active?:boolean|null };
type Item = { id:string; name:string; country:string; city:string; leagues:string[]; leagueIds:string[]; aliases:string[]; aliasIds:string[] };
type Props = {
  mode?: "team"|"league"; directorySource?:"teams"|"womens_teams"|"both"; leagueSource?:"leagues"|"womens_leagues"; allCategories?:boolean; label?:string; placeholder?:string; value?:string; values?:string[];
  multiple?:boolean; returnValue?:"id"|"name"; basketballType?:Gender|null;
  onChange?:(value:string)=>void; onChangeMany?:(values:string[])=>void;
  onSelectItem?:(item:{id:string;name:string;country:string;city:string;league_name:string})=>void;
  disabled?:boolean;
};

async function fetchAll<T>(table:string, columns:string, filters:(query:any)=>any):Promise<T[]> {
  const rows:T[]=[]; const pageSize=1000;
  for(let offset=0;offset<10000;offset+=pageSize){
    let query=supabase.from(table).select(columns); query=filters(query);
    const {data,error}=await query.range(offset,offset+pageSize-1);
    if(error) throw error;
    const page=(data||[]) as T[]; rows.push(...page);
    if(page.length<pageSize) break;
  }
  return rows;
}
function cleanName(value:string){
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
    .replace(/\b(women'?s|women|female|ladies|girls|men'?s|men|male)\b/g," ")
    .replace(/\b(basketball|club|bc|b\.c\.|b\.k\.|bk)\b/g," ")
    .replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
}
function initials(value:string){return value.split(/\s+/).filter(Boolean).map(word=>word[0]).join("");}
function abbreviations(value:string){const words=cleanName(value).split(" ").filter(word=>word.length>1);return [words.map(word=>word[0]).join(""),words.map(word=>word.slice(0,2)).join("")].join(" ");}
function norm(value:string|null|undefined){return (value||"").trim().toLowerCase();}

export default function TeamLeaguePicker({
  mode="team",directorySource="teams",leagueSource,allCategories=false,label,placeholder,value="",values,multiple=false,returnValue="id",
  basketballType=null,onChange,onChangeMany,onSelectItem,disabled=false,
}:Props){
  const [open,setOpen]=useState(false);
  const [items,setItems]=useState<Item[]>([]);
  const [loading,setLoading]=useState(false);
  const [hasLoaded,setHasLoaded]=useState(false);
  const [loadError,setLoadError]=useState("");
  const [query,setQuery]=useState("");
  const [debouncedQuery,setDebouncedQuery]=useState("");
  const [country,setCountry]=useState("");
  const [league,setLeague]=useState("");
  const [activeGender,setActiveGender]=useState<Gender>(basketballType||"mens");
  const [selectedIds,setSelectedIds]=useState<string[]>(values||(value?[value]:[]));

  useEffect(()=>{setActiveGender(basketballType||"mens");setItems([]);setHasLoaded(false);setCountry("");setLeague("");},[basketballType]);
  useEffect(()=>{setSelectedIds(values||(value?[value]:[]));},[value,values?.join("|")]);
  useEffect(()=>{const timer=window.setTimeout(()=>setDebouncedQuery(query.trim()),250);return()=>window.clearTimeout(timer);},[query]);

  useEffect(()=>{
    if((!open&&selectedIds.length===0)||hasLoaded) return;
    let active=true; setLoading(true); setLoadError("");
    void (async()=>{
      try{
        let nextItems:Item[]=[];
        if(mode==="league"){
          const table=leagueSource||(allCategories?"leagues":activeGender==="womens"?"womens_leagues":"leagues");
          const rows=await fetchAll<LeagueRow>(table,table==="womens_leagues"?"id,name,country":"id,name,country,basketball_type",q=>q.eq("active",true).order("name"));
          const eligibleRows=allCategories||table==="womens_leagues"?rows:rows.filter(row=>!row.basketball_type||norm(row.basketball_type)===activeGender);
          nextItems=eligibleRows.map(row=>({id:row.id,name:row.name,country:row.country||"",city:"",leagues:[],leagueIds:[],aliases:[row.name],aliasIds:[row.id]}));
        }else{
          const sources:("teams"|"womens_teams")[]=directorySource==="both"?["teams","womens_teams"]:[directorySource];
          const dataSets=await Promise.all(sources.map(async source=>{
            const columns=source==="womens_teams"?"id,name,country,city,league_name,league_id,created_at":"id,name,country,city,league_name,league_id,basketball_type,created_at";
            const [rows,leagueRows,memberships]=await Promise.all([
              fetchAll<TeamRow>(source,columns,q=>q.eq("active",true).order("name")),
              fetchAll<LeagueRow>(source==="womens_teams"?"womens_leagues":"leagues",source==="womens_teams"?"id,name,country":"id,name,country,basketball_type",q=>q.eq("active",true).order("name")),
              source==="womens_teams"?Promise.resolve([] as MembershipRow[]):fetchAll<MembershipRow>("team_league_memberships","team_id,league_id,active",q=>q.eq("active",true)),
            ]);
            const leagueById=new Map(leagueRows.map(row=>[row.id,row]));
            const context=new Map<string,{names:string[];ids:string[]}>();
            for(const row of rows){
              const names=[...(row.league_name?[row.league_name]:[]),...(row.league_id&&leagueById.has(row.league_id)?[leagueById.get(row.league_id)!.name]:[])];
              const ids=row.league_id?[row.league_id]:[];
              if(source==="teams"){
                for(const membership of memberships.filter(entry=>entry.team_id===row.id)){
                  const leagueName=leagueById.get(membership.league_id)?.name;
                  if(leagueName)names.push(leagueName);
                  ids.push(membership.league_id);
                }
              }
              context.set(source+":"+row.id,{names:[...new Set(names)],ids:[...new Set(ids)]});
            }
            return {rows:rows.map(row=>({...row,source})),context};
          }));
          const teamRows=dataSets.flatMap(set=>set.rows);
          const leagueContext=new Map<string,{names:string[];ids:string[]}>();
          for(const set of dataSets)for(const [key,value] of set.context)leagueContext.set(key,value);
          const grouped=new Map<string,TeamRow[]>();
          for(const row of teamRows){
            if(row.source==="womens_teams"&&activeGender!=="womens")continue;
            if(row.source==="teams"&&row.basketball_type&&activeGender==="mens"&&!["mens","men","male"].includes(norm(row.basketball_type)))continue;
            if(row.source==="teams"&&row.basketball_type&&activeGender==="womens"&&!["womens","women","female"].includes(norm(row.basketball_type)))continue;
            const key=cleanName(row.name)+"|"+norm(row.country);
            const group=grouped.get(key)||[];group.push(row);grouped.set(key,group);
          }
          for(const rows of grouped.values()){
            const cities=[...new Set(rows.map(row=>norm(row.city)).filter(Boolean))];
            const cityBuckets=new Map<string,TeamRow[]>();
            for(const row of rows){
              const city=norm(row.city);const bucket=city||(cities.length===1?cities[0]:"");
              const group=cityBuckets.get(bucket)||[];group.push(row);cityBuckets.set(bucket,group);
            }
            for(const group of cityBuckets.values()){
              const sorted=[...group].sort((a,b)=>{
                if(directorySource==="both"&&activeGender==="womens"){
                  const priority=(row:TeamRow)=>row.source==="womens_teams"?0:1;
                  const diff=priority(a)-priority(b);if(diff)return diff;
                }
                return (a.created_at||"9999").localeCompare(b.created_at||"9999")||a.id.localeCompare(b.id);
              });
              const canonical=sorted[0];
              const leagueNames=[...new Set(sorted.flatMap(row=>leagueContext.get((row.source||"teams")+":"+row.id)?.names||[]))].sort();
              const leagueIds=[...new Set(sorted.flatMap(row=>leagueContext.get((row.source||"teams")+":"+row.id)?.ids||[]))];
              nextItems.push({
                id:directorySource==="both"?(canonical.source||"teams")+":"+canonical.id:canonical.id,
                name:canonical.name,country:canonical.country||"",city:canonical.city||"",
                leagues:leagueNames,leagueIds,aliases:[...new Set(sorted.map(row=>row.name))],aliasIds:[...new Set(sorted.map(row=>directorySource==="both"?(row.source||"teams")+":"+row.id:row.id))],
              });
            }
          }
          nextItems.sort((a,b)=>a.name.localeCompare(b.name));
        }
        if(active) { setItems(nextItems); setHasLoaded(true); }
      }catch(error){
        console.error("Team/league picker load failed:",error);
        if(active) setLoadError("We couldn't load the directory. Close this picker and try again.");
      }finally{if(active)setLoading(false);}
    })();
    return()=>{active=false;};
  },[open,hasLoaded,mode,activeGender,directorySource,leagueSource,allCategories,selectedIds.length]);

  const countries=useMemo(()=>[...new Set(items.map(item=>item.country).filter(Boolean))].sort(),[items]);
  const leagues=useMemo(()=>{
    const pool=items.filter(item=>!country||item.country===country);
    return [...new Set(pool.flatMap(item=>mode==="league"?[item.name]:item.leagues))].sort();
  },[items,country,mode]);
  const filtered=useMemo(()=>{
    const q=debouncedQuery.toLowerCase();
    return items.filter(item=>{
      if(country&&item.country!==country)return false;
      if(league&&(mode==="league"?item.name!==league:!item.leagues.includes(league)))return false;
      if(!q)return true;
      const fields=[item.name,...item.aliases,item.city,item.country,...item.leagues,initials(item.name),abbreviations(item.name)];
      return fields.some(field=>norm(field).includes(q))||initials(item.name).toLowerCase().startsWith(q);
    }).slice(0,50);
  },[items,country,league,debouncedQuery,mode]);

  const selectedItems=useMemo(()=>selectedIds.map(id=>items.find(item=>item.id===id||item.aliasIds.includes(id))||items.find(item=>returnValue==="name"&&(item.name===id||item.aliases.includes(id)))).filter(Boolean) as Item[],[items,selectedIds,returnValue]);
  const displayItems=selectedItems.length?selectedItems:(returnValue==="name"?selectedIds.map(name=>({id:name,name,country:"",city:"",leagues:[],leagueIds:[],aliases:[name],aliasIds:[name]})):[]);
  function displayValue(item:Item){return returnValue==="name"?item.name:item.id;}
  function canonicalIds(){return selectedIds.map(id=>items.find(item=>item.id===id||item.aliasIds.includes(id)||(returnValue==="name"&&(item.name===id||item.aliases.includes(id))))?.id||id);}
  function choose(item:Item){
    if(multiple){
      const currentIds=canonicalIds();
      const next=currentIds.includes(item.id)?currentIds.filter(id=>id!==item.id):[...currentIds,item.id];
      setSelectedIds(next);
      onChangeMany?.(next.map(id=>{const found=items.find(entry=>entry.id===id);return found?displayValue(found):id;}));
    }else{
      setSelectedIds([item.id]); onChange?.(displayValue(item)); onChangeMany?.([displayValue(item)]);
    }
    onSelectItem?.({id:item.id,name:item.name,country:item.country,city:item.city,league_name:item.leagues[0]||""});
    setOpen(false);setQuery("");setCountry("");setLeague("");
  }
  function remove(item:Item){
    const next=canonicalIds().filter(id=>id!==item.id);
    setSelectedIds(next);onChangeMany?.(next.map(id=>{const found=items.find(entry=>entry.id===id);return found?displayValue(found):id;}));
    if(!multiple){onChange?.("");onSelectItem?.({id:"",name:"",country:"",city:"",league_name:""});}
  }

  return <div className="hc-shared-picker">
    {label&&<label className="hc-shared-picker-label">{label}</label>}
    <div className="hc-shared-picker-values">
      {displayItems.map(item=><span key={item.id} className="hc-shared-picker-chip"><span>{item.name}</span><button type="button" aria-label={"Remove "+item.name} onClick={()=>remove(item)} disabled={disabled}>×</button></span>)}
      <button type="button" className="hc-shared-picker-trigger" disabled={disabled} onClick={()=>setOpen(true)}>{displayItems.length?(multiple?"Add another":"Change selection"):(placeholder||(mode==="team"?"Choose a team":"Choose a league"))}</button>
      {displayItems.length>0&&!multiple&&<button type="button" className="hc-shared-picker-clear" onClick={()=>remove(displayItems[0])} disabled={disabled}>Remove</button>}
    </div>
    {open&&<div className="hc-shared-picker-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false);}}>
      <section className="hc-shared-picker-dialog" role="dialog" aria-modal="true" aria-label={label||(mode==="team"?"Choose a team":"Choose a league")}>
        <header className="hc-shared-picker-sticky">
          <div className="hc-shared-picker-dialog-heading"><strong>{mode==="team"?"Choose a team":"Choose a league"}</strong><button type="button" onClick={()=>setOpen(false)} aria-label="Close picker">×</button></div>
          {basketballType==null&&!allCategories&&<div className="hc-shared-picker-gender"><button type="button" className={activeGender==="mens"?"is-active":""} onClick={()=>{setActiveGender("mens");setItems([]);setHasLoaded(false);setCountry("");setLeague("");}}>Men’s</button><button type="button" className={activeGender==="womens"?"is-active":""} onClick={()=>{setActiveGender("womens");setItems([]);setHasLoaded(false);setCountry("");setLeague("");}}>Women’s</button></div>}
          <label className="hc-shared-picker-search-label">Search {mode==="team"?"teams":"leagues"}<input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="Name, abbreviation, city or country…" /></label>
          <div className={"hc-shared-picker-filters"+(mode==="league"?" is-league-picker":"")}>
            <label>Country<select value={country} onChange={event=>{setCountry(event.target.value);setLeague("");}}><option value="">All countries</option>{countries.map(item=><option key={item} value={item}>{item}</option>)}</select></label>
            {mode==="team"&&<label>League<select value={league} onChange={event=>setLeague(event.target.value)}><option value="">All leagues</option>{leagues.map(item=><option key={item} value={item}>{item}</option>)}</select></label>}
          </div>
          <p className="hc-shared-picker-count">{loading?"Loading directory…":filtered.length+(filtered.length===50?"+":"")+" results shown · maximum 50"}</p>
        </header>
        <div className="hc-shared-picker-results" aria-live="polite">
          {loading?<p className="hc-shared-picker-state">Loading directory…</p>
            :loadError?<p className="hc-shared-picker-state" role="alert">{loadError}</p>
            :!debouncedQuery&&!country&&!league?<p className="hc-shared-picker-state">Search by name or use the country and league filters to browse.</p>
            :debouncedQuery.length===1?<p className="hc-shared-picker-state">Type at least 2 characters to search.</p>
            :filtered.length?filtered.map(item=><button type="button" key={item.id} className={"hc-shared-picker-row"+(selectedItems.some(selected=>selected.id===item.id)?" is-selected":"")} onClick={()=>choose(item)}><span className="hc-shared-picker-row-main"><strong>{item.name}</strong><small>{[item.city,item.country,item.leagues.slice(0,1).join(""),item.leagues.length>1?"+"+(item.leagues.length-1)+" more leagues":""].filter(Boolean).join(" · ")||"Basketball directory"}</small></span><span className="hc-shared-picker-row-check">{selectedItems.some(selected=>selected.id===item.id)?"✓":"+"}</span></button>)
            :<p className="hc-shared-picker-state">No "+mode+" matches '"+(debouncedQuery||league||country)+"' — try the spelling, or browse by country and league.</p>}
        </div>
        <footer className="hc-shared-picker-footer"><button type="button" className="btn dark" onClick={()=>setOpen(false)}>Close</button></footer>
      </section>
    </div>}
  </div>;
}
