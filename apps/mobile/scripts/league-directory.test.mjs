import assert from "node:assert/strict";
import {test} from "node:test";
import {createClient} from "@supabase/supabase-js";
import {leagueDirectoryQuery,leagueDirectoryScope,readLeagueCountries} from "../src/native/leagueDirectory.ts";
const fixture=()=>{const calls=[];const client=createClient("https://fixture.example","key",{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async input=>{calls.push(new URL(String(input)));return Response.json([{id:"a",country:"Spain"},{id:"b",country:"Iceland"},{id:"c",country:"Spain"},{id:"d",country:null}]);}}});return {client,calls};};
test("leagues preserve exact country, active men's scope and stable bounded pages",async()=>{
 const {client,calls}=fixture();await leagueDirectoryQuery(client,"Test (city),country.eq.secret",40,"Côte d’Ivoire");
 const url=calls[0];assert.equal(url.pathname,"/rest/v1/leagues");assert.equal(url.searchParams.get("active"),"eq.true");assert.equal(url.searchParams.get("basketball_type"),"eq.mens");assert.equal(url.searchParams.get("country"),"eq.Côte d’Ivoire");assert.equal(url.searchParams.get("order"),"name.asc,id.asc");assert.equal(url.searchParams.get("limit"),"41");assert.equal(url.searchParams.get("offset"),"40");assert.match(url.searchParams.get("or"),/Test city country eq secret/);
});
test("country picker uses actual league labels with deduplication and cancellation",async()=>{
 const {client,calls}=fixture();assert.deepEqual(await readLeagueCountries(client,new AbortController().signal),{countries:["Iceland","Spain"],complete:true});assert.equal(calls[0].searchParams.get("select"),"id,country");const abort=new AbortController();abort.abort();await assert.rejects(readLeagueCountries(client,abort.signal),/cancelled/);assert.equal(calls.length,1);
});
test("women's league pages and country labels use the canonical women's table and separate cache scope",async()=>{
 const {client,calls}=fixture();
 await leagueDirectoryQuery(client,"National",40,"Spain",true);
 await readLeagueCountries(client,new AbortController().signal,true);
 assert.ok(calls.every(url=>url.pathname==="/rest/v1/womens_leagues"&&url.searchParams.get("active")==="eq.true"&&!url.searchParams.has("basketball_type")));
 assert.equal(calls[0].searchParams.get("select"),"id,name,country,level");
 assert.equal(calls[0].searchParams.get("country"),"eq.Spain");
 assert.equal(calls[0].searchParams.get("order"),"name.asc,id.asc");
 assert.equal(calls[0].searchParams.get("offset"),"40");
 assert.notEqual(leagueDirectoryScope(true,"National","Spain"),leagueDirectoryScope(false,"National","Spain"));
});
