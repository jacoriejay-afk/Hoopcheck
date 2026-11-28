import {test} from "node:test";import assert from "node:assert/strict";
import {nativeDestination} from "../src/native/deepLinks.ts";
import {notificationPath,noticeMatches,refreshGroupAlerts} from "../src/native/notifications.ts";
import {groupAlertId,resolveGroupChannelLink} from "../src/native/groupAlertLinks.ts";
import {readGroupInvitation,groupAlertPreference} from "../src/native/groupAccess.ts";
const uid="11111111-1111-4111-8111-111111111111",space="22222222-2222-4222-8222-222222222222",channel="33333333-3333-4333-8333-333333333333",foreign="44444444-4444-4444-8444-444444444444";
test("group alerts use UUID-only private routes and dedicated filters",()=>{
 for(const [type,key] of [["group_invite","invitation"],["group_discussion","channel"]]){
 const notice={target_type:type,target_id:channel,notification_type:"group_invitation",read_at:null};
 const path="/hoopgroups?"+key+"="+channel;
 assert.equal(notificationPath(notice),path);assert.equal(nativeDestination("https://hoopcheck.online"+path),path);
 assert.equal(nativeDestination(path+"&"+key+"="+space),"/hoopgroups");
 assert.equal(notificationPath({...notice,target_id:"../secret"}),null);assert.equal(noticeMatches(notice,"groups"),true);assert.equal(noticeMatches(notice,"clubs"),false);
 }
 assert.equal(groupAlertId([channel]),null);
});
function mock(values,owner=uid){const calls=[];const auth={getSession:async()=>({data:{session:{user:{id:owner},access_token:"token"}},error:null}),getUser:async()=>({data:{user:{id:uid}},error:null})};const client={auth,from(t){const q={select(){return q;},eq(k,v){calls.push([t,k,v]);return q;},setHeader(k,v){assert.equal(v,"Bearer token");return q;},abortSignal(){return q;},async maybeSingle(){return {data:values[t],error:null};}};return q;},rpc(name,args){calls.push([name,args]);return {setHeader(k,v){assert.equal(v,"Bearer token");return this;},async abortSignal(){return {data:values[name],error:null};}};}};return {client,calls};}
const s={id:space,slug:"fixture",name:"Fixture",category:"global",description:"",owner_id:uid,accent_color:"orange",icon_key:"basketball"},c={id:channel,space_id:space,slug:"topic",name:"Topic",sort_index:1},m={space_id:space,user_id:uid};
test("discussion links require exact channel, visible community, membership and same account",async()=>{
 const signal=new AbortController().signal,values={hoop_group_spaces:s,hoop_group_channels:c,hoop_group_members:m};
 assert.deepEqual(await resolveGroupChannelLink(mock(values).client,uid,channel,"Bearer token",signal),{space:s,channel:c});
 assert.equal(await resolveGroupChannelLink(mock({...values,hoop_group_members:null}).client,uid,channel,"Bearer token",signal),null);
 assert.equal(await resolveGroupChannelLink(mock({...values,hoop_group_channels:null}).client,uid,channel,"Bearer token",signal),null);
 await assert.rejects(resolveGroupChannelLink(mock(values,foreign).client,uid,channel,"Bearer token",signal));
});
test("invitation and preference RPCs reject mismatched data; materialization remains bounded",async()=>{
 const signal=new AbortController().signal,invite={id:channel,group_name:"Fixture",expires_at:"2026-12-01T00:00:00Z"};
 assert.deepEqual(await readGroupInvitation(mock({hoop_group_invitation_detail:invite}).client,uid,channel,signal),invite);
 await assert.rejects(readGroupInvitation(mock({hoop_group_invitation_detail:{...invite,id:foreign}}).client,uid,channel,signal));
 assert.equal(await groupAlertPreference(mock({hoop_group_alert_preference:true}).client,uid,space,channel,true,signal),true);
 await assert.rejects(groupAlertPreference(mock({hoop_group_alert_preference:false}).client,uid,space,channel,true,signal));
 const scope={uid,bearer:"Bearer token",signal};assert.equal(await refreshGroupAlerts(mock({refresh_my_hoop_group_alerts:100}).client,scope),100);
 await assert.rejects(refreshGroupAlerts(mock({refresh_my_hoop_group_alerts:101}).client,scope));
});
