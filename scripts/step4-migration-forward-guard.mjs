// Offline forward-only migration guard; no network, SQL execution or schema repair.
import { readFileSync } from "node:fs";
function inspect(base,candidate) {
  const version = /^\d{14}$/;
  const filename = /^(\d{14})_[A-Za-z0-9][A-Za-z0-9_.-]*\.sql$/;
  const sha = /^[0-9a-f]{40}$/;
  function object(x, keys) {
    return x !== null && typeof x === "object" && !Array.isArray(x) &&
      Object.keys(x).length === keys.length && keys.every(k => Object.hasOwn(x,k));
  }
  function inventory(s, isBase) {
    if (!object(s,isBase?["format","commit","files","ledgerVersions"]:["format","commit","files"]) ||
        s.format !== 1 || typeof s.commit !== "string" || !sha.test(s.commit) ||
        !Array.isArray(s.files) || !s.files.length || s.files.length>10000) throw Error("invalid_snapshot");
    const result = new Map();
    for (const f of s.files) {
      if (!object(f,["name","sha"]) || typeof f.name!=="string" || !filename.test(f.name) ||
          typeof f.sha!=="string" || !sha.test(f.sha) || result.has(f.name)) throw Error("invalid_file_inventory");
      result.set(f.name,f.sha);
    }
    if (isBase && (!Array.isArray(s.ledgerVersions) || !s.ledgerVersions.length || s.ledgerVersions.length>10000 ||
      s.ledgerVersions.some(v=>typeof v!=="string"||!version.test(v)) ||
      new Set(s.ledgerVersions).size!==s.ledgerVersions.length)) throw Error("invalid_ledger");
    return result;
  }
  const old = inventory(base,true), next = inventory(candidate,false);
  const oldIds = [...old.keys()].map(n=>n.slice(0,14));
  const counts = new Map();
  for (const v of oldIds) counts.set(v,(counts.get(v)||0)+1);
  const historicalDuplicates = [...counts].filter(([,n])=>n>1).map(([v])=>v).sort();
  const highWater = [...oldIds,...base.ledgerVersions].sort().at(-1);
  const removed=[], edited=[], added=[], invalidNew=[], seenNew=new Set();
  for (const [name,hash] of old) {
    if (!next.has(name)) removed.push(name);
    else if (next.get(name)!==hash) edited.push(name);
  }
  for (const name of next.keys()) if (!old.has(name)) {
    added.push(name);
    const v=name.slice(0,14);
    if(v<=highWater||seenNew.has(v)) invalidNew.push(name);
    seenNew.add(v);
  }
  return {
    base_commit:base.commit, candidate_commit:candidate.commit,
    high_water_version:highWater, historical_duplicate_versions:historicalDuplicates,
    added:added.sort(), removed:removed.sort(), edited:edited.sort(),
    invalid_new_versions:invalidNew.sort(),
    forward_only_guard_passed:!removed.length&&!edited.length&&!invalidNew.length,
    full_schema_parity_verified:false, migration_replay_authorized:false
  };
}
function selfTest() {
  const h="a".repeat(40), j="b".repeat(40);
  const file=(v,n,sha=h)=>({name:v+"_"+n+".sql",sha});
  const old={format:1,commit:h,files:[file("20261101000000","one"),file("20261101000000","two")],ledgerVersions:["20261102000000"]};
  const next=()=>({format:1,commit:j,files:old.files.map(x=>({...x}))});
  const tests=[
    ["historical duplicate retained",x=>{},true],
    ["forward addition",x=>x.files.push(file("20261103000000","new")),true],
    ["history edit",x=>x.files[0].sha=j,false],
    ["history removal",x=>x.files.pop(),false],
    ["old version",x=>x.files.push(file("20261101000000","new")),false],
    ["ledger high water",x=>x.files.push(file("20261102000000","new")),false],
    ["new duplicate",x=>x.files.push(file("20261103000000","a"),file("20261103000000","b")),false],
    ["same count rename",x=>x.files[1].name="20261103000000_renamed.sql",false]
  ];
  for(const [name,mutate,want] of tests){const x=next();mutate(x);const r=inspect(old,x);if(r.forward_only_guard_passed!==want||r.full_schema_parity_verified||r.migration_replay_authorized||r.historical_duplicate_versions.length!==1)throw Error(name);}
  for(const [name,mutate] of [["malformed filename",x=>x.files.push({name:"../secret.sql",sha:h})],["duplicate file",x=>x.files.push(x.files[0])],["invalid hash",x=>x.files[0].sha="bad"],["extra field",x=>x.files[0].body="not accepted"]]){
    const x=next();mutate(x);let rejected=false;try{inspect(old,x)}catch{rejected=true}if(!rejected)throw Error(name);
  }
  let rejected=false;try{inspect({...old,ledgerVersions:[]},next())}catch{rejected=true}if(!rejected)throw Error("missing ledger");
  return tests.length+5;
}
function readManifest(path) {
  const bytes=readFileSync(path);
  if(bytes.length>2*1024*1024) throw Error("oversized_manifest");
  return JSON.parse(bytes.toString("utf8"));
}
try {
  if(process.argv.length===3&&process.argv[2]==="--self-test") console.log(selfTest()+" fixture checks passed");
  else {
    if(process.argv.length!==4) throw Error("usage");
    const result=inspect(readManifest(process.argv[2]),readManifest(process.argv[3]));
    console.log(JSON.stringify(result,null,2));
    if(!result.forward_only_guard_passed) process.exitCode=1;
  }
} catch {
  console.error("Migration guard: invalid input or self-test failure");
  process.exitCode=2;
}
