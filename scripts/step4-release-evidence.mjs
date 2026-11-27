// Offline structural gate; never contacts providers or grants release approval.
import { readFileSync } from "node:fs";
function evaluate(m,now){
 const gates={ci:"candidate",security:"candidate",schema_restore:"disposable",web_smoke:"isolated",ios_signed:"signed-device",android_signed:"signed-device",billing:"sandbox",operations:"candidate"};
 const validSha=s=>typeof s==="string"&&/^[a-f0-9]{40}$/.test(s);
 const label=s=>typeof s==="string"&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(s);
 const date=s=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
 const only=(o,keys)=>o&&typeof o==="object"&&!Array.isArray(o)&&Object.keys(o).every(k=>keys.includes(k));
 const evidence=s=>typeof s==="string"&&/^https:\/\/github\.com\/jacoriejay-afk\/Hoopcheck\/(?:actions\/runs\/\d+|pull\/\d+|issues\/\d+|blob\/[a-f0-9]{40}\/[A-Za-z0-9._/-]+)(?:#[A-Za-z0-9_-]+)?$/.test(s);
 if(!Number.isFinite(now)||!only(m,["sha","iosBuild","androidBuild","gates"])||!validSha(m.sha)||!label(m.iosBuild)||!label(m.androidBuild)||!Array.isArray(m.gates)||m.gates.length>Object.keys(gates).length)return {state:"HOLD",blocked:["invalid_manifest"]};
 const seen=new Set(),passed=new Set();
 for(const e of m.gates){
  if(!only(e,["gate","sha","environment","build","result","evidence","reviewer","checkedAt"])||!Object.hasOwn(gates,e.gate)||seen.has(e.gate))return {state:"HOLD",blocked:["invalid_or_duplicate_gate"]};
  seen.add(e.gate);
  const build=e.gate==="ios_signed"?m.iosBuild:e.gate==="android_signed"?m.androidBuild:"not-applicable";
  if(e.sha===m.sha&&e.environment===gates[e.gate]&&e.build===build&&e.result==="pass"&&evidence(e.evidence)&&label(e.reviewer)&&date(e.checkedAt)&&Date.parse(e.checkedAt)<=now&&now-Date.parse(e.checkedAt)<=7*86400000)passed.add(e.gate);
 }
 const blocked=Object.keys(gates).filter(g=>!passed.has(g));
 return {state:blocked.length?"HOLD":"EVIDENCE_COMPLETE_REVIEW_REQUIRED",blocked};
}
const now=Date.parse("2026-11-27T09:00:00.000Z"), candidate="a".repeat(40);
const fixture=()=>({sha:candidate,iosBuild:"17",androidBuild:"17",gates:Object.entries({ci:"candidate",security:"candidate",schema_restore:"disposable",web_smoke:"isolated",ios_signed:"signed-device",android_signed:"signed-device",billing:"sandbox",operations:"candidate"}).map(([gate,environment])=>({gate,environment,sha:candidate,build:gate.endsWith("_signed")?"17":"not-applicable",result:"pass",evidence:"https://github.com/jacoriejay-afk/Hoopcheck/actions/runs/1",reviewer:"fixture",checkedAt:"2026-11-27T08:00:00.000Z"}))});
const cases=[["complete",x=>{},false],["missing",x=>x.gates.pop(),true],["duplicate",x=>x.gates[1]=x.gates[0],true],["wrong sha",x=>x.gates[0].sha="b".repeat(40),true],["wrong signed build",x=>x.gates[4].build="16",true],["wrong environment",x=>x.gates[2].environment="production",true],["stale",x=>x.gates[0].checkedAt="2026-11-01T00:00:00.000Z",true],["future",x=>x.gates[0].checkedAt="2026-11-28T00:00:00.000Z",true],["failed",x=>x.gates[0].result="fail",true],["untrusted link",x=>x.gates[0].evidence="https://example.com/",true],["extra field",x=>x.gates[0].token="secret",true],["invalid date",x=>x.gates[0].checkedAt="2026-11-31T00:00:00.000Z",true]];
if(process.argv[2]==="--self-test"){for(const [name,mutate,hold] of cases){const x=fixture();mutate(x);if((evaluate(x,now).state==="HOLD")!==hold)throw Error(name);} console.log(cases.length+" fixture checks passed");}else{let result;try{if(process.argv.length!==3)throw Error("manifest required");const raw=readFileSync(process.argv[2],"utf8");if(raw.length>65536)throw Error("oversized");result=evaluate(JSON.parse(raw),Date.now());}catch{result={state:"HOLD",blocked:["invalid_manifest"]};}console.log(JSON.stringify(result));if(result.state==="HOLD")process.exitCode=1;}
