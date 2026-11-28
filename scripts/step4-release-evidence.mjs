// Offline structural gate; never contacts providers or grants release approval.
import { closeSync, constants, fstatSync, openSync, readSync } from "node:fs";
function evaluate(m,now,expected){
 const gates={ci:"candidate",security:"candidate",schema_restore:"disposable",web_smoke:"isolated",ios_signed:"signed-device",android_signed:"signed-device",billing:"sandbox",hosted_auth:"isolated",privacy_fulfillment:"isolated",external_providers:"sandbox",legal_approval:"candidate",ios_native_capabilities:"signed-device",android_native_capabilities:"signed-device",combined_technical:"candidate",operations:"candidate"};
 const validSha=s=>typeof s==="string"&&/^[a-f0-9]{40}$/.test(s);
 const label=s=>typeof s==="string"&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(s);
 const date=s=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
 const only=(o,keys)=>o&&typeof o==="object"&&!Array.isArray(o)&&Object.keys(o).every(k=>keys.includes(k));
 const evidence=s=>typeof s==="string"&&/^https:\/\/github\.com\/jacoriejay-afk\/Hoopcheck\/(?:actions\/runs\/\d+|pull\/\d+|issues\/\d+|blob\/[a-f0-9]{40}\/[A-Za-z0-9._/-]+)(?:#[A-Za-z0-9_-]+)?$/.test(s);
 if(!Number.isFinite(now)||!only(m,["sha","iosBuild","androidBuild","gates"])||!validSha(m.sha)||!label(m.iosBuild)||!label(m.androidBuild)||!Array.isArray(m.gates)||m.gates.length>Object.keys(gates).length)return {state:"HOLD",blocked:["invalid_manifest"]};
 if (!only(expected, ["sha", "iosBuild", "androidBuild"]) || !validSha(expected.sha) ||
   !label(expected.iosBuild) || !label(expected.androidBuild)) {
  return { state: "HOLD", blocked: ["invalid_expected_candidate"] };
 }
 if (m.sha !== expected.sha || m.iosBuild !== expected.iosBuild || m.androidBuild !== expected.androidBuild) {
  return { state: "HOLD", blocked: ["candidate_identity_mismatch"] };
 }
 const seen=new Set(),passed=new Set();
 for(const e of m.gates){
  if(!only(e,["gate","sha","environment","build","result","evidence","reviewer","checkedAt"])||!Object.hasOwn(gates,e.gate)||seen.has(e.gate))return {state:"HOLD",blocked:["invalid_or_duplicate_gate"]};
  seen.add(e.gate);
  const build=e.gate==="ios_signed"||e.gate==="ios_native_capabilities"?m.iosBuild:e.gate==="android_signed"||e.gate==="android_native_capabilities"?m.androidBuild:"not-applicable";
  if(e.sha===m.sha&&e.environment===gates[e.gate]&&e.build===build&&e.result==="pass"&&evidence(e.evidence)&&label(e.reviewer)&&date(e.checkedAt)&&Date.parse(e.checkedAt)<=now&&now-Date.parse(e.checkedAt)<=7*86400000)passed.add(e.gate);
 }
 const blocked=Object.keys(gates).filter(g=>!passed.has(g));
 return {state:blocked.length?"HOLD":"EVIDENCE_COMPLETE_REVIEW_REQUIRED",blocked};
}
const now=Date.parse("2026-11-27T09:00:00.000Z"), candidate="a".repeat(40);
const fixture=()=>({sha:candidate,iosBuild:"17",androidBuild:"17",gates:Object.entries({ci:"candidate",security:"candidate",schema_restore:"disposable",web_smoke:"isolated",ios_signed:"signed-device",android_signed:"signed-device",billing:"sandbox",hosted_auth:"isolated",privacy_fulfillment:"isolated",external_providers:"sandbox",legal_approval:"candidate",ios_native_capabilities:"signed-device",android_native_capabilities:"signed-device",combined_technical:"candidate",operations:"candidate"}).map(([gate,environment])=>({gate,environment,sha:candidate,build:gate.endsWith("_signed")||gate.endsWith("_native_capabilities")?"17":"not-applicable",result:"pass",evidence:"https://github.com/jacoriejay-afk/Hoopcheck/actions/runs/1",reviewer:"fixture",checkedAt:"2026-11-27T08:00:00.000Z"}))});
const cases=[["complete",x=>{},false],["missing",x=>x.gates.pop(),true],["duplicate",x=>x.gates[1]=x.gates[0],true],["wrong sha",x=>x.gates[0].sha="b".repeat(40),true],["wrong signed build",x=>x.gates[4].build="16",true],["wrong environment",x=>x.gates[2].environment="production",true],["stale",x=>x.gates[0].checkedAt="2026-11-01T00:00:00.000Z",true],["future",x=>x.gates[0].checkedAt="2026-11-28T00:00:00.000Z",true],["failed",x=>x.gates[0].result="fail",true],["untrusted link",x=>x.gates[0].evidence="https://example.com/",true],["extra field",x=>x.gates[0].token="secret",true],["invalid date",x=>x.gates[0].checkedAt="2026-11-31T00:00:00.000Z",true],...["hosted_auth","privacy_fulfillment","external_providers","legal_approval"].map(gate=>["missing "+gate,x=>{x.gates=x.gates.filter(e=>e.gate!==gate);},true]),["synthetic privacy evidence",x=>x.gates.find(e=>e.gate==="privacy_fulfillment").environment="synthetic",true],["fixture provider evidence",x=>x.gates.find(e=>e.gate==="external_providers").environment="candidate",true],["failed hosted auth",x=>x.gates.find(e=>e.gate==="hosted_auth").result="fail",true],...["ios_signed","android_signed","ios_native_capabilities","android_native_capabilities","combined_technical"].map(gate=>["missing "+gate,x=>{x.gates=x.gates.filter(e=>e.gate!==gate);},true]),...["ios_native_capabilities","android_native_capabilities"].flatMap(gate=>[["wrong build "+gate,x=>x.gates.find(e=>e.gate===gate).build="16",true],["unsigned "+gate,x=>x.gates.find(e=>e.gate===gate).environment="candidate",true]]),["wrong combined revision",x=>x.gates.find(e=>e.gate==="combined_technical").sha="b".repeat(40),true],["distinct signed builds",x=>{x.androidBuild="18";for(const e of x.gates)if(e.gate==="android_signed"||e.gate==="android_native_capabilities")e.build="18";},false]];
function readManifest(path) {
 const fd = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK);
 try {
  if (!fstatSync(fd).isFile()) throw Error("Expected a regular evidence manifest.");
  const raw = Buffer.alloc(65537);
  let offset = 0;
  while (offset < raw.length) {
   const count = readSync(fd, raw, offset, raw.length - offset, offset);
   if (count === 0) break;
   offset += count;
  }
  if (offset >= raw.length) throw Error("Evidence manifest is too large.");
  return JSON.parse(raw.subarray(0, offset).toString("utf8"));
 } finally { closeSync(fd); }
}

if (process.argv.length === 3 && process.argv[2] === "--self-test") {
 for (const [name, mutate, hold] of cases) {
  const manifest = fixture();
  mutate(manifest);
  const expected = { sha: candidate, iosBuild: "17", androidBuild: name === "distinct signed builds" ? "18" : "17" };
  if ((evaluate(manifest, now, expected).state === "HOLD") !== hold) throw Error(name);
 }
 console.log(cases.length + " fixture checks passed");
 const manifest = fixture();
 const pin = { sha: candidate, iosBuild: "17", androidBuild: "17" };
 for (const expected of [undefined, { ...pin, sha: "b".repeat(40) }, { ...pin, iosBuild: "18" }, { ...pin, androidBuild: "18" }]) {
  if (evaluate(manifest, now, expected).state !== "HOLD") throw Error("candidate pin");
 }
 console.log("4 independent candidate identity checks passed");
} else {
 let result;
 try {
  const [path, sha, iosBuild, androidBuild, ...extra] = process.argv.slice(2);
  if (!path || !sha || !iosBuild || !androidBuild || extra.length) {
   result = { state: "HOLD", blocked: ["invalid_expected_candidate"] };
  } else {
   result = evaluate(readManifest(path), Date.now(), { sha, iosBuild, androidBuild });
  }
 } catch { result = { state: "HOLD", blocked: ["invalid_manifest"] }; }
 console.log(JSON.stringify(result));
 if (result.state === "HOLD") process.exitCode = 1;
}
