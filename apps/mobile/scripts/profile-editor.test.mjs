import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createClient} from '@supabase/supabase-js';
import {parseProfileDraft,profileCover,readOwnProfile,saveOwnProfile,saveOwnCover} from '../src/native/profileEditor.ts';
const uid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const row={id:uid,account_type:'player',first_name:'Locked',last_name:'Identity',username:'fixture',years_pro:4,display_name:'Member',bio:'Bio',hometown:'Town',nationality:'US',favorite_teams:'Club',favorite_leagues:'League',interests:'Interest',experience_summary:'Experience',position:'PG',height:'193 cm',current_country:'France',current_team:'Fixture',free_agent:false,current_country_public:false,profile_visibility:'players_only'};
const db=request=>{const client=createClient('https://fixture.supabase.co','fixture-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:request}});client.auth.getSession=async()=>({data:{session:{user:{id:uid},access_token:'fixture-owner-token'}},error:null});return client;};
test('own profile reads exact ID and excludes membership, billing and permission columns',async()=>{
 let url;const profile=await readOwnProfile(db(async input=>{url=new URL(String(input));return Response.json(row);}),uid);
 assert.equal(profile.first_name,'Locked');assert.equal(profile.years_pro,'4');assert.equal(url.pathname,'/rest/v1/rpc/get_own_profile');assert.equal(url.search,'');
 await assert.rejects(readOwnProfile(db(async()=>Response.json({...row,id:other})),uid));
 await assert.rejects(readOwnProfile(db(async()=>Response.json({...row,account_type:'owner'})),uid));
});
test('player updates are bounded, own-scoped and cannot modify verified identity or membership',async()=>{
 let body;const client=db(async(input,options)=>{if(options.method==='PATCH'){assert.equal(new URL(String(input)).searchParams.get('id'),`eq.${uid}`);}else{assert.equal(new URL(String(input)).pathname,'/rest/v1/rpc/get_own_profile');}if(options.method==='PATCH'){body=JSON.parse(options.body);return Response.json({id:uid});}return Response.json(row);});
 await saveOwnProfile(client,uid,{...row,first_name:'Forged',years_pro:99,player_verified:true,admin_role:'owner',account_type:'coach',display_name:' x '.repeat(100),bio:'b'.repeat(1000),free_agent:true,current_team:'Should clear',experience_summary:'Do not change'});
 assert.ok(body.display_name.length<=80);assert.equal(body.display_name,body.display_name.trim());assert.equal(body.bio.length,500);assert.equal(body.current_team,null);assert.equal(body.free_agent,true);assert.equal(body.position,'PG');
 for(const key of ['first_name','years_pro','player_verified','admin_role','account_type','experience_summary','id'])assert.equal(key in body,false);
});
test('current server role controls the field allowlist and private profile roles cannot publish',async()=>{
 for(const role of ['fan','agent','scout','coach']){
  let body;const client=db(async(_,options)=>options.method==='PATCH'?(body=JSON.parse(options.body),Response.json({id:uid})):Response.json({...row,account_type:role}));
  await saveOwnProfile(client,uid,{...row,profile_visibility:'public'});
  assert.equal('position' in body,false);assert.equal('free_agent' in body,false);
  assert.equal('profile_visibility' in body,role==='coach');assert.equal('experience_summary' in body,role==='coach');
 }
});
test('read/write failures and missing mutation acknowledgment do not claim a saved profile',async()=>{
 await assert.rejects(saveOwnProfile(db(async()=>Response.json({message:'denied'},{status:403})),uid,row));
 await assert.rejects(saveOwnProfile(db(async(_,options)=>Response.json(options.method==='PATCH'?null:row)),uid,row),/could not be confirmed/);
 assert.equal(parseProfileDraft({...row,free_agent:'true'}),null);assert.equal(profileCover('forged'),'court');assert.equal(profileCover('rose'),'rose');
});
test('appearance updates freeze the verified JWT and only send the cover metadata key',async()=>{
 let active=uid;let seen;
 const client={auth:{getSession:async()=>({data:{session:{access_token:'old-owner-token',user:{id:uid}}},error:null}),getUser:async token=>{assert.equal(token,'old-owner-token');active=other;return{data:{user:{id:uid}},error:null};},updateUser:async()=>{throw Error('Mutable auth write must not run');}}};
 await saveOwnCover(client,uid,'rose','https://fixture.supabase.co','public-key',async(url,options)=>{seen={url,options};assert.equal(active,other);return Response.json({id:uid,user_metadata:{hoopcheck_profile_cover:'rose'}});});
 assert.equal(seen.url,'https://fixture.supabase.co/auth/v1/user');assert.equal(seen.options.headers.Authorization,'Bearer old-owner-token');assert.equal(seen.options.headers.apikey,'public-key');assert.equal(seen.options.redirect,'error');assert.deepEqual(JSON.parse(seen.options.body),{data:{hoopcheck_profile_cover:'rose'}});
 let writes=0;client.auth.getSession=async()=>({data:{session:{access_token:'new-token',user:{id:other}}},error:null});
 await assert.rejects(saveOwnCover(client,uid,'rose','https://fixture.supabase.co','public-key',async()=>{writes++;return Response.json({});}));assert.equal(writes,0);
});
