import test from "node:test";
import assert from "node:assert/strict";
import {opportunityMatches,emptyOpportunityCriteria,matchExplanation} from "../src/native/opportunityMatches.ts";
const rows=[{id:1,free_agent:true,position:"PG",years_pro:5,player_verified:true},{id:2,free_agent:true,position:"PG",years_pro:null,player_verified:false},{id:3,free_agent:false,position:"PG",years_pro:10,player_verified:true},{id:4,free_agent:true,position:"SG",years_pro:6,player_verified:true}];
test("only returned, explicitly available records are eligible",()=>{assert.deepEqual(opportunityMatches(rows,emptyOpportunityCriteria).map(x=>x.id),[1,2,4]);assert.deepEqual(opportunityMatches(rows,{position:" pg ",minimumYears:"3",verifiedOnly:true}).map(x=>x.id),[1]);});
test("invalid or missing required experience fails closed",()=>{for(const minimumYears of ["-1","51","abc","2.5"])assert.deepEqual(opportunityMatches(rows,{...emptyOpportunityCriteria,minimumYears}),[]);assert.deepEqual(opportunityMatches(rows,{...emptyOpportunityCriteria,minimumYears:"0"}).map(x=>x.id),[1,4]);assert.match(matchExplanation(emptyOpportunityCriteria),/Self-listed availability/);});
