import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import ts from "typescript";
function compile(path, imports) {
  const code = ts.transpileModule(readFileSync(new URL(path,import.meta.url),"utf8"),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText;
  const m={exports:{}}; new Function("require","module","exports",code)(imports,m,m.exports); return m.exports;
}
const owner="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222",id="33333333-3333-4333-8333-333333333333";
const mfa=compile("../lib/auth/mfa-core.ts",()=>{throw Error("Unexpected import");});
const fields={
  reviews:"author_id,id,title,body,status,overall_rating,player_season,team_id,coach_id,league_id,is_anonymous,created_at",
  womens_team_reviews:"author_id,id,title,body,status,overall_rating,womens_team_id,is_anonymous,created_at",
  feed_posts:"author_id,id,body,created_at",
  fan_feed_posts:"author_id,id,body,created_at",
  membership_sources:"user_id,id,plan,status,access_status,current_period_end,cancel_at_period_end,billing_interval,provider",
};
const profileFields="id,display_name,username,first_name,last_name,bio,account_type,current_country,current_country_public,current_team,position,years_pro,profile_visibility,free_agent,created_at,updated_at,agreed_to_terms";
function fixture(opts={}) {
  const calls=[];
  let checks=0;
  const token="e30."+Buffer.from(JSON.stringify({sub:owner,exp:Math.floor(Date.now()/1000)+600,aal:opts.aal??"aal1"})).toString("base64url")+".fixture";
  const user={id:owner,email_confirmed_at:opts.unconfirmed?null:"2026-11-01",is_anonymous:opts.anonymous??false,factors:opts.mfa?[{id:other,factor_type:"totp",status:"verified"}]:[]};
  const db={
    auth:{
      async getUser(t){assert.equal(t,token);return {data:{user:opts.invalid?null:user},error:null};},
      async getClaims(t){assert.equal(t,token);return {data:{claims:{sub:opts.claimOwner??owner,role:opts.role??"authenticated"}},error:null};},
    },
    rpc(name){
      calls.push(["rpc",name]);
      if(name==="confirm_active_account_session"){checks++;return Promise.resolve({data:opts.active!==false&&!(opts.revoked&&checks>1),error:null});}
      if(name==="get_own_review_snapshot") return {async abortSignal(signal){
        assert.ok(signal instanceof AbortSignal);
        const build=table=>{
          const row=Object.fromEntries(fields[table].split(",").map(k=>[k,null]));
          row.id=id;row.author_id=opts.foreignRow&&table==="reviews"?other:owner;
          row.admin_notes="internal";
          if(opts.count===101&&table==="reviews")return Array.from({length:101},(_,i)=>({...row,id:"33333333-3333-4333-8333-"+String(i).padStart(12,"0")}));
          return opts.empty?[]:opts.duplicate&&table==="reviews"?[row,row]:[row];
        };
        const men=build("reviews"),women=build("womens_team_reviews");
        return {data:{owner_id:opts.reviewOwner??owner,reviews:men,reviews_count:opts.count!==undefined?opts.count:men.length,womens_reviews:women,womens_reviews_count:women.length},error:opts.readError?Error("fixture"):null};
      }};
      assert.equal(name,"get_own_profile");
      return {async abortSignal(signal){
        assert.ok(signal instanceof AbortSignal);
        const data=Object.fromEntries(profileFields.split(",").map(k=>[k,null]));
        Object.assign(data,{id:opts.profileOwner??owner,display_name:"Synthetic player",moderation_note:"internal",stripe_identity_session_id:"secret"});
        if(opts.missingField)delete data.username;
        return {data,error:null};
      }};
    },
    from(table){
      calls.push(["table",table]);assert.ok(table in fields);assert.ok(!["reviews","womens_team_reviews"].includes(table),"Direct author-column query forbidden");
      return {
        select(columns,options){assert.equal(columns,fields[table]);assert.deepEqual(options,{count:"exact"});return this;},
        eq(k,v){assert.equal(k,table==="membership_sources"?"user_id":"author_id");assert.equal(v,owner);return this;},
        order(k){assert.equal(k,"id");return this;},
        limit(n){assert.equal(n,100);return this;},
        async abortSignal(signal){
          assert.ok(signal instanceof AbortSignal);
          const row=Object.fromEntries(fields[table].split(",").map(k=>[k,null]));
          row.id=id;row[table==="membership_sources"?"user_id":"author_id"]=opts.foreignRow&&table==="reviews"?other:owner;
          row.admin_notes="internal";row.stripe_subscription_id="secret";
          const data=opts.empty?[]:opts.duplicate&&table==="reviews"?[row,row]:[row];
          return {data,count:table==="reviews"&&opts.count!==undefined?opts.count:data.length,error:opts.readError&&table==="reviews"?Error("fixture"):null};
        }
      };
    },
  };
  const {POST}=compile("../app/api/account/account-snapshot-export/route.ts",name=>{
    if(name==="next/server")return {NextResponse:{json:(data,init)=>Response.json(data,init)}};
    if(name==="@supabase/supabase-js")return {createClient:(url,key,config)=>{
      assert.equal(url,"https://fixture.invalid");assert.equal(key,"fixture-public");assert.equal(config.global.headers.Authorization,"Bearer "+token);return db;
    }};
    if(name.endsWith("/mfa-core"))return mfa;
    throw Error(name);
  });
  return {calls,async run(query="",authorization="Bearer "+token){
    const keys=["ACCOUNT_SNAPSHOT_EXPORT_ENABLED","NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],old=keys.map(k=>process.env[k]);
    try{
      process.env[keys[0]]=opts.disabled?"false":"true";process.env[keys[1]]="https://fixture.invalid";process.env[keys[2]]="fixture-public";
      return await POST(new Request("https://fixture.invalid/api/account/account-snapshot-export"+query,{method:"POST",headers:{authorization},body:JSON.stringify({owner:other})}));
    }finally{keys.forEach((k,i)=>{if(old[i]===undefined)delete process.env[k];else process.env[k]=old[i];});}
  }};
}
test("default-off, malformed bearer and query targeting stop before reads",async()=>{
  for(const [opts,query,auth,status] of [[{disabled:true},"",undefined,503],[{},"","Basic invalid",401],[{},"?owner="+other,undefined,400]]){
    const f=fixture(opts);assert.equal((await f.run(query,auth)).status,status);assert.deepEqual(f.calls,[]);
  }
});
test("invalid identity, MFA, revoked session and wrong claims deny before profile read",async()=>{
  for(const opts of [{invalid:true},{unconfirmed:true},{anonymous:true},{mfa:true},{active:false},{claimOwner:other},{role:"anon"}]){
    const f=fixture(opts);assert.equal((await f.run()).status,403);assert.ok(!f.calls.some(c=>c[1]==="get_own_profile"||c[0]==="table"));
  }
});
test("owner receives explicit partial snapshot without internal fields",async()=>{
  const r=await fixture({mfa:true,aal:"aal2"}).run();
  assert.equal(r.status,200);assert.match(r.headers.get("cache-control"),/no-store/);assert.match(r.headers.get("content-disposition"),/attachment/);
  const body=await r.json();assert.equal(body.complete,false);assert.equal(body.scope,"currently_accessible_account_snapshot_only");
  assert.equal(body.data.profile.id,owner);assert.equal(body.data.profile.display_name,"Synthetic player");
  assert.equal(body.data.reviews.length,1);assert.equal(body.data.womens_reviews.length,1);assert.equal(body.data.player_posts.length,1);assert.equal(body.data.fan_posts.length,1);assert.equal(body.data.membership_sources.length,1);
  assert.doesNotMatch(JSON.stringify(body),/moderation_note|stripe_identity_session_id|admin_notes|stripe_subscription_id|requester_id|author_id|user_id/);
});
test("foreign records, missing fields, incomplete counts and late revocation never download",async()=>{
  for(const [opts,status] of [[{profileOwner:other},503],[{reviewOwner:other},503],[{foreignRow:true},503],[{missingField:true},503],[{count:null},503],[{count:2},503],[{count:101},409],[{duplicate:true},503],[{readError:true},503],[{revoked:true},403]]){
    const r=await fixture(opts).run();assert.equal(r.status,status);assert.equal(r.headers.get("content-disposition"),null);assert.ok(!("data" in await r.json()));
  }
});
test("empty visible records do not claim the complete account is empty",async()=>{
  const r=await fixture({empty:true}).run();assert.equal(r.status,200);const body=await r.json();assert.equal(body.complete,false);assert.deepEqual(body.data.reviews,[]);
});

test("snapshot profile allowlist is a subset of the reviewed owner RPC contract",()=>{
 const sql=readFileSync(new URL("../supabase/candidates/build8_scoped_owner_profile_rpc.sql",import.meta.url),"utf8");
 const projection=sql.match(/SELECT jsonb_build_object\(([\s\S]*?)\) INTO result/);
 assert.ok(projection);
 const keys=new Set([...projection[1].matchAll(/'([a-z_]+)',p\.[a-z_]+/g)].map(m=>m[1]));
 assert.ok(keys.size>0);
 for(const field of profileFields.split(",")) assert.ok(keys.has(field),field+" absent from owner RPC");
 const route=readFileSync(new URL("../app/api/account/account-snapshot-export/route.ts",import.meta.url),"utf8");
 const fields=route.match(/const profileFields = \[([^\]]+)\] as const;/);
 assert.ok(fields);
 assert.deepEqual(JSON.parse("["+fields[1]+"]"),profileFields.split(","));
});
