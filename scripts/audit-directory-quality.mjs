#!/usr/bin/env node
// Offline directory quality audit; reads sanitized directory-only JSON, never connects to a provider or database.
// Usage: node scripts/audit-directory-quality.mjs current.json [baseline.json] [--strict]
import {readFileSync} from "node:fs";
import ts from "typescript";
const source=readFileSync(new URL("../lib/owner/directory-quality.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {deriveDirectoryQuality,compareDirectoryCoverage}=await import("data:text/javascript;base64,"+Buffer.from(compiled).toString("base64"));
const args=process.argv.slice(2),strict=args.includes("--strict"),files=args.filter(x=>x!=="--strict");
const schema={
  leagues:["id","name","country","basketball_type","logo_url","season"],
  teams:["id","name","country","basketball_type","logo_url","league_id"],
  memberships:["team_id","league_id","season"],
};
function load(path){
  const data=JSON.parse(readFileSync(path,"utf8"));
  if(!data||typeof data!=="object"||Array.isArray(data)||Object.keys(data).some(k=>!(k in schema)))throw Error("Expected directory-only active snapshot");
  for(const [table,keys] of Object.entries(schema)){
    if(!Array.isArray(data[table]))throw Error("Missing snapshot table: "+table);
    for(const row of data[table]){
      if(!row||typeof row!=="object"||Array.isArray(row)||Object.keys(row).some(k=>!keys.includes(k))||keys.some(k=>!(k in row)||!(row[k]===null||typeof row[k]==="string")))throw Error("Invalid or non-directory snapshot fields: "+table);
      if(table!=="memberships"&&(!row.id||!row.name)||table==="memberships"&&(!row.team_id||!row.league_id))throw Error("Missing directory identity");
    }
  }
  return deriveDirectoryQuality(data.leagues,data.teams,data.memberships);
}
try{
  if(files.length<1||files.length>2||files.some(x=>x.startsWith("--")))throw Error("Usage: current.json [baseline.json] [--strict]");
  const quality=load(files[0]),baseline=files[1]?load(files[1]):null;
  const changes=baseline?compareDirectoryCoverage(baseline,quality):{removedLeagues:[],addedLeagues:[],seasonChanges:[],rosterChanges:[]};
  const unverifiedLeagueSeasons=quality.leagues-quality.verifiedLeagueCount;
  const rosterDiscrepancies=quality.coverage.filter(row=>row.evidence&&(row.missing.length||row.unexpected.length||row.ambiguous.length||row.actual!==row.expected));
  const {coverage: _coverage,...counts}=quality;
  console.log(JSON.stringify({counts,rosterDiscrepancies,changedSameSeasonCounts:changes.rosterChanges.filter(row=>row.before!==row.after),baselineChanges:changes,unverifiedLeagueSeasons,scope:"Active canonical directory only; remote logo health, licenses, sync status and unverified seasons are not certified by this offline check."},null,2));
  if(strict&&(quality.unlinked||quality.wrongSidePrimary||quality.unavailablePrimary||quality.wrongSideMemberships||quality.duplicateTeamGroups||quality.duplicateLeagueGroups||quality.missingSeason||quality.missingTeamLogos||quality.missingLeagueLogos||quality.invalidLogoURLs||quality.countryAliasWarnings.length||quality.missingReviewedCompetitions.length||rosterDiscrepancies.length||unverifiedLeagueSeasons||changes.removedLeagues.length||changes.addedLeagues.length||changes.seasonChanges.length||changes.rosterChanges.length))process.exitCode=1;
}catch(error){
  console.error(error instanceof Error?error.message:"Invalid directory audit");process.exitCode=2;
}
