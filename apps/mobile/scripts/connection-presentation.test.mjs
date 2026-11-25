import assert from 'node:assert/strict';
import { test } from 'node:test';
import { visibleConnections, visibleFollowers, connectionPath } from '../src/native/connectionPresentation.ts';
const id='11111111-1111-4111-8111-111111111111';
const row=(type,account_type=type)=>({target_type:type,target_id:id,id,display_name:'Member',account_type,email:'must-not-project@example.test'});
test('connection presentation retains website fan scope and drops malformed/unknown identities',()=>{
 const input=[row('team'),row('fan'),row('player'),row('agent'),{...row('team'),target_id:'../private'},null];
 assert.deepEqual(visibleConnections(input,'fan').map(r=>r.target_type),['team','fan']);
 assert.deepEqual(visibleConnections(input,'player').map(r=>r.target_type),['team','fan','player']);
 assert.equal(JSON.stringify(visibleConnections(input,'player')).includes('must-not-project'),false);
 assert.throws(()=>visibleConnections({},'player'));
});
test('connection destinations never expose player links to fans or private account types',()=>{
 assert.equal(connectionPath(row('player'),'fan'),null);
 assert.equal(connectionPath(row('player','manager'),'player'),null);
 assert.equal(connectionPath(row('player'),'player'),`/players/${id}`);
 assert.equal(connectionPath(row('fan'),'fan'),`/fans/${id}`);
 assert.equal(connectionPath(row('team'),'fan'),`/teams/${id}`);
});

test('followers use the follower identity rather than the followed profile and retain role visibility',()=>{
 const fan='22222222-2222-4222-8222-222222222222', player='33333333-3333-4333-8333-333333333333';
 const inputs=[{id:fan,target_id:id,target_type:'player',account_type:'fan',display_name:'Fan',email:'private'},{id:player,target_id:id,target_type:'player',account_type:'player',display_name:'Player'},{id:player,target_id:fan,target_type:'player',account_type:'player'},{id:id,target_id:id,target_type:'player',account_type:'player'},{id:fan,target_id:id,target_type:'player',account_type:'fan'}];
 const rows=visibleFollowers(inputs,id,'player');
 assert.deepEqual(rows.map(r=>r.target_id),[fan,player]);
 assert.deepEqual(rows.map(r=>connectionPath(r,'player')),[`/fans/${fan}`,`/players/${player}`]);
 assert.equal(JSON.stringify(rows).includes('private'),false);
 assert.deepEqual(visibleFollowers(inputs,id,'fan'),[]);
 const fanRows=visibleFollowers(inputs.map(r=>({...r,target_type:'fan'})),id,'fan');
 assert.deepEqual(fanRows.map(r=>r.target_id),[fan]);
 assert.deepEqual(visibleFollowers(inputs,id,'agent'),[]);
 assert.throws(()=>visibleFollowers({},id,'player'));
});
