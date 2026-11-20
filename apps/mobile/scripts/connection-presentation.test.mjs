import assert from 'node:assert/strict';
import { test } from 'node:test';
import { visibleConnections, connectionPath } from '../src/native/connectionPresentation.ts';
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
