import assert from "node:assert/strict";
import {test} from "node:test";
import {createClient} from "@supabase/supabase-js";
import {leagueDirectoryQuery,readLeagueCountries} from "../src/native/leagueDirectory.ts";
const fixture=()=>{const calls=[];const client=createClient("https://fixture.example","key",{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async input=>{calls.push(new URL(String(input)));return Response.json([{id:"a",country:"Spain"},{id:"b",country:"Iceland"},{id:"c",country:"Spain"},{id:"d",country:null}]);}}});return {client,calls};};
test("leagues preserve exact country, active men's scope and stable bounded pages",async()=>{
 const {client,calls}=fixture();await leagueDirectoryQuery(client,"Test (city),country.eq.secret",40,"Côte d’Ivoire");
 const url=calls[0];assert.equal(url.pathname,"/rest/v1/leagues");assert.equal(url.searchParams.get("active"),"eq.true");assert.equal(url.searchParams.get("basketball_type"),"eq.mens");assert.equal(url.searchParams.get("country"),"eq.Côte d’Ivoire");assert.equal(url.searchParams.get("order"),"name.asc,id.asc");assert.equal(url.searchParams.get("limit"),"41");assert.equal(url.searchParams.get("offset"),"40");assert.match(url.searchParams.get("or"),/Test city country eq secret/);
});
test("country picker uses actual league labels with deduplication and cancellation",async()=>{
 const {client,calls}=fixture();assert.deepEqual(await readLeagueCountries(client,new AbortController().signal),{countries:["Iceland","Spain"],complete:true});assert.equal(calls[0].searchParams.get("select"),"id,country");const abort=new AbortController();abort.abort();await assert.rejects(readLeagueCountries(client,abort.signal),/cancelled/);assert.equal(calls.length,1);
});
