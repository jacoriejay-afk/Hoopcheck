#!/usr/bin/env node
// Offline, read-only deletion policy coverage preflight. No DB/provider connections.
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import assert from "node:assert/strict";
function inventoryKeys(inventory) {
  if (!inventory || typeof inventory.version !== "string" ||
      !Array.isArray(inventory.directForeignKeys) || !inventory.directForeignKeys.length ||
      !Array.isArray(inventory.identityLikeColumns) || !inventory.identityLikeColumns.length ||
      !Array.isArray(inventory.externalSystems) || !inventory.externalSystems.length) throw Error("Invalid inventory");
  const keys = [];
  const requireText = s => { if (typeof s !== "string" || !s.trim()) throw Error("Invalid inventory entry"); return s; };
  for (const row of inventory.directForeignKeys)
    keys.push(JSON.stringify(["fk",requireText(row.schema_name),requireText(row.table_name),requireText(row.conname),requireText(row.definition)]));
  for (const row of inventory.identityLikeColumns)
    keys.push(JSON.stringify(["columns",requireText(row.table_schema),requireText(row.table_name),requireText(row.identity_like_columns)]));
  for (const name of inventory.externalSystems) keys.push(JSON.stringify(["external",requireText(name)]));
  for (const name of ["recursive_cascades","polymorphic_references","json_and_text_snapshots","media_and_provider_copies","candidate_schema_delta","legal_holds_and_third_party_rights","anonymized_reviews_and_trust_scores","billing_and_commission_preservation","worker_receipts_and_completion_contact"])
    keys.push(JSON.stringify(["cross_cutting",name]));
  if (new Set(keys).size !== keys.length) throw Error("Duplicate inventory entries");
  return keys.sort();
}
function evaluate(inventory, plan, inventorySha) {
  const keys = inventoryKeys(inventory);
  if (typeof inventorySha !== "string" || !/^[a-f0-9]{64}$/.test(inventorySha) ||
      !plan || plan.format !== 1 || plan.inventorySha256 !== inventorySha ||
      plan.inventoryVersion !== inventory.version || !Array.isArray(plan.decisions) ||
      typeof plan.candidateCommit !== "string" || !/^[a-f0-9]{40}$/.test(plan.candidateCommit) ||
      typeof plan.policyVersion !== "string" || !plan.policyVersion.trim() ||
      typeof plan.reviewEvidence !== "string" || !plan.reviewEvidence.trim())
    throw Error("Missing or stale policy evidence");
  const expected = new Set(keys), seen = new Set(), pending = [];
  for (const row of plan.decisions) {
    if (!row || !expected.has(row.key) || seen.has(row.key)) throw Error("Unknown or duplicate decision");
    seen.add(row.key);
    if (!["erase","anonymize","retain","not_applicable"].includes(row.action) ||
        typeof row.basis !== "string" || !row.basis.trim() ||
        typeof row.evidence !== "string" || !row.evidence.trim() ||
        typeof row.verification !== "string" || !row.verification.trim() ||
        row.legalHoldCleared !== true ||
        (row.action === "retain" && (!Number.isSafeInteger(row.retentionDays) || row.retentionDays <= 0 ||
         typeof row.expiryAction !== "string" || !row.expiryAction.trim())) ||
        (row.key === JSON.stringify(["cross_cutting","anonymized_reviews_and_trust_scores"]) && row.action !== "anonymize"))
      pending.push(row.key);
  }
  const missing = keys.filter(k=>!seen.has(k));
  return {inventoryEntries:keys.length, missing, unresolved:pending.sort(),
    structurallyComplete:missing.length===0&&pending.length===0,
    deletionAuthorized:false, workerActivationAuthorized:false};
}
const [inventoryFile, planFile] = process.argv.slice(2);
try {
  const bytes = readFileSync(inventoryFile);
  const inv = JSON.parse(bytes.toString("utf8"));
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (planFile === "--template") {
    console.log(JSON.stringify({format:1,inventoryVersion:inv.version,inventorySha256:digest,
      candidateCommit:null,policyVersion:null,reviewEvidence:null,
      decisions:inventoryKeys(inv).map(key=>({key,action:null,basis:null,evidence:null,verification:null,legalHoldCleared:false,retentionDays:null,expiryAction:null}))},null,2));
  } else if (planFile === "--self-test") {
    const keys=inventoryKeys(inv);
    const plan={format:1,inventoryVersion:inv.version,inventorySha256:digest,candidateCommit:"b".repeat(40),policyVersion:"synthetic",reviewEvidence:"synthetic",decisions:keys.map(key=>({key,action:"anonymize",basis:"synthetic",evidence:"synthetic",verification:"synthetic",legalHoldCleared:true}))};
    assert.equal(evaluate(inv,plan,digest).structurallyComplete,true);
    assert.equal(evaluate(inv,plan,digest).deletionAuthorized,false);
    assert.equal(evaluate(inv,{...plan,decisions:[]},digest).missing.length,keys.length);
    assert.equal(evaluate(inv,{...plan,decisions:plan.decisions.map((r,i)=>i===0?{...r,legalHoldCleared:false}:r)},digest).unresolved.length,1);
    assert.equal(evaluate(inv,{...plan,decisions:plan.decisions.map((r,i)=>i===0?{...r,action:"retain",retentionDays:0}:r)},digest).unresolved.length,1);
    assert.equal(evaluate(inv,{...plan,decisions:plan.decisions.map(r=>r.key===JSON.stringify(["cross_cutting","anonymized_reviews_and_trust_scores"])?{...r,action:"erase"}:r)},digest).unresolved.length,1);
    for(const bad of [{...plan,inventorySha256:"c".repeat(64)},{...plan,decisions:[...plan.decisions,plan.decisions[0]]},{...plan,decisions:[{key:"unknown"}]}]) assert.throws(()=>evaluate(inv,bad,digest));
    console.log("9 synthetic checks passed; no deletion authorization.");
  } else {
    const result=evaluate(inv,JSON.parse(readFileSync(planFile,"utf8")),digest);
    console.log(JSON.stringify(result,null,2));
    process.exitCode=result.structurallyComplete?0:1;
  }
} catch {
  console.error("Invalid or stale deletion review inputs. No deletion authorized.");
  process.exitCode=2;
}
