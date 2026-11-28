import {test} from "node:test";import assert from "node:assert/strict";
import {readGroupDirectoryPage} from "../src/native/groupDirectoryPage.ts";
const uid="11111111-1111-4111-8111-111111111111",space="22222222-2222-4222-8222-222222222222",channel="33333333-3333-4333-8333-333333333333";
const row={id:space,slug:"fixture",name:"Fixture",category:"global",description:"",owner_id:uid,accent_color:"orange",icon_key:"basketball",joined:true};
const topic={id:channel,space_id:space,slug:"topic",name:"Topic",sort_index:0};
function mock(data,owner=uid){let args;return {get args(){return args;},client:{auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:"fixture"}}})},rpc(name,value){assert.equal(name,"hoop_group_directory_page");args=value;return {setHeader(k,v){assert.equal(v,"Bearer fixture");return this;},async abortSignal(){return {data,error:null};}};}}};}
test("group search passes cursor and validates account, channel ownership and mode",async()=>{
 const input={query:"older topic",mode:"joined",after:channel},signal=new AbortController().signal,m=mock({rows:[row],channels:[topic],has_more:false});
 const result=await readGroupDirectoryPage(m.client,uid,"Bearer fixture",input,signal);
 assert.equal(result.spaces[0].name,"Fixture");assert.deepEqual(result.joined,[space]);assert.equal(result.next,null);assert.deepEqual(m.args,{p_query:"older topic",p_mode:"joined",p_after:channel,p_slug:null});
 await assert.rejects(readGroupDirectoryPage(mock({rows:[{...row,joined:false}],channels:[],has_more:false}).client,uid,"Bearer fixture",input,signal));
 await assert.rejects(readGroupDirectoryPage(mock({rows:[row],channels:[{...topic,space_id:channel}],has_more:false}).client,uid,"Bearer fixture",input,signal));
 await assert.rejects(readGroupDirectoryPage(mock({rows:[row],channels:[],has_more:false},channel).client,uid,"Bearer fixture",input,signal));
});
