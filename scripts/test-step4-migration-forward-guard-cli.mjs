// Execute the actual CLI and assert exit codes, without providers or SQL.
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const guard=fileURLToPath(new URL("./step4-migration-forward-guard.mjs",import.meta.url));
const dir=mkdtempSync(join(tmpdir(),"hc-migration-guard-"));
const h="a".repeat(40), j="b".repeat(40);
const old={format:1,commit:h,files:[{name:"20261101000000_old.sql",sha:h}],ledgerVersions:["20261102000000"]};
const candidate={format:1,commit:j,files:[...old.files]};
const a=join(dir,"base.json"), b=join(dir,"candidate.json");
function run(expected, value, raw=false){
  writeFileSync(a,JSON.stringify(old));writeFileSync(b,raw?value:JSON.stringify(value));
  const result=spawnSync(process.execPath,[guard,a,b],{encoding:"utf8",timeout:10000});
  assert.equal(result.error,undefined);assert.equal(result.status,expected,result.stderr);
  if(expected!==2){
    const parsed=JSON.parse(result.stdout);
    assert.equal(parsed.forward_only_guard_passed,expected===0);
    assert.equal(parsed.full_schema_parity_verified,false);
    assert.equal(parsed.migration_replay_authorized,false);
  } else assert.equal(result.stdout,"");
}
try {
  run(0,candidate);
  run(1,{...candidate,files:[{...old.files[0],sha:j}]});
  run(1,{...candidate,files:[...old.files,{name:"20261102000000_collision.sql",sha:j}]});
  run(2,"{",true);
  run(2,{...candidate,files:[...old.files,{name:"20261131000000_invalid.sql",sha:j}]});
  run(2," ".repeat(2*1024*1024+1),true);
  console.log("6 migration guard CLI checks passed");
} finally {rmSync(dir,{recursive:true,force:true});}
