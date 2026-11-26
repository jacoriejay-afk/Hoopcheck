"use client";
import {useState} from "react";
import Link from "next/link";
import {findIntelligenceTopics,intelligenceTopics,type IntelligenceTopic} from "../apps/mobile/src/native/intelligenceGuide";
export default function IntelligenceGuide(){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(""),[result,setResult]=useState<IntelligenceTopic[]|null>(null);
 function search(value:string){setQuery(value);setResult(findIntelligenceTopics(value));}
 return <section className="dashboard-card" aria-label="HoopCheck Intelligence"><h2>HoopCheck Intelligence</h2><p>Find relevant reviewed basketball guidance. This limited lookup does not answer live or player-specific questions; no AI service is used.</p><button className="btn" type="button" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{open?"Close guidance":"Ask a basketball question"}</button>
 {open?<><form onSubmit={e=>{e.preventDefault();search(query);}}><label>Question<input maxLength={160} value={query} onChange={e=>{setQuery(e.target.value);setResult(null);}} placeholder="How do I verify a club?"/></label><button className="btn" disabled={query.trim().length<3}>Find guidance</button></form>
 <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{intelligenceTopics.map(topic=><button type="button" className="btn dark" key={topic.id} onClick={()=>search(topic.phrases[0])}>{topic.title}</button>)}</div>
 <div role="status">{result===null?null:result.length?result.map(topic=><article key={topic.id}><h3>{topic.title}</h3><p>{topic.answer}</p><Link href={topic.webPath}>Source: {topic.source}</Link></article>):<p>No supported guidance matched. Search the directory for actual team or player records, or try one of the topics above.</p>}</div></>:null}</section>;
}
