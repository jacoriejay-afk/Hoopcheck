/* eslint-disable @typescript-eslint/no-require-imports -- Isolated browser fixture only. */
const { chromium } = require("playwright"), assert = require("node:assert/strict");
const base = process.env.NATIVE_TEST_URL || "http://127.0.0.1:8092";
if (!["localhost","127.0.0.1"].includes(new URL(base).hostname)) throw Error("Local fixture only");
const id = n => "11111111-1111-4111-8111-" + String(n).padStart(12,"0");
const uid=id(30), ml=id(50), wl=id(51);
const men=[{id:id(10),name:"Home Men"},{id:id(11),name:"Away Men"}], women=[{id:id(12),name:"Home Women"},{id:id(13),name:"Away Women"}];
const matches=[
 {id:id(1),team_id:men[0].id,opponent_team_id:men[1].id,opponent_name:men[1].name,league_name:"Men Fixture League",country:"Spain"},
 {id:id(2),team_id:women[0].id,opponent_team_id:women[1].id,opponent_name:women[1].name,league_name:"Women Fixture League",country:"Spain"},
 {id:id(3),team_id:men[0].id,opponent_team_id:men[1].id,opponent_name:men[1].name,league_name:"Men Fixture League",country:"Spain",status:"cancelled"},
].map(g=>({status:"scheduled",scheduled_at:new Date(Date.now()+3600_000).toISOString(),home_score:null,away_score:null,started_at:null,ends_at:null,period_label:null,...g}));
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:["--no-sandbox"]});
 try { for(const theme of ["light","dark"]){
  const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:theme});
  const requests=[],errors=[];
  const user={id:uid,aud:"authenticated",email:"fixture@example.test",role:"authenticated",factors:[]};
  const expires=Math.floor(Date.now()/1000)+3600;
  const token=Buffer.from('{"alg":"HS256"}').toString("base64url")+"."+Buffer.from(JSON.stringify({sub:uid,exp:expires,role:"authenticated",aal:"aal1"})).toString("base64url")+".fixture";
  await context.routeWebSocket("**/*",s=>s.close());
  await context.route("**/*",async route=>{
    const request=route.request(),url=new URL(request.url()),method=request.method();
    if(url.origin===new URL(base).origin)return route.continue();
    const json=(data,status=200)=>route.fulfill({status,contentType:"application/json",headers:{"access-control-allow-origin":"*","access-control-allow-headers":"*"},body:JSON.stringify(data)});
    if(method==="OPTIONS")return json({});
    requests.push({path:url.pathname,method,params:url.searchParams});
    if(url.hostname==="api.test"){
      if(url.pathname==="/api/mobile/bootstrap")return json({user:{id:uid,displayName:"Schedule Member",accountType:"fan"},entitlements:{tier:"premium",hasPaidMembership:true,canReadHoopFeed:true,canWriteHoopFeed:true,canUseLiveGameHub:true,canUseLiveGameChat:true,canSwitchBasketballSide:true,canUseFanGroups:true}});
      if(url.pathname.includes("review"))return json({canReadFull:false,canWrite:false,reviews:[]});
      return json({},404);
    }
    if(url.hostname!=="fixture.supabase.co")return route.abort();
    if(url.pathname==="/auth/v1/user")return json(user);
    const table=url.pathname.split("/").pop();
    if(table==="fan_live_games"){assert.equal(method,"GET");return json(matches);}
    if(table==="profiles")return json({preferred_basketball_side:"mens",avatar_url:null,avatar_moderation_status:"pending"});
    if(table==="fan_live_chat_room_open")return json(false);
    if(table==="leagues")return json({id:ml,name:"Men Fixture League",country:"Spain",level:"Professional"});
    if(table==="womens_leagues")return json({id:wl,name:"Women Fixture League",country:"Spain",level:"Professional"});
    if(table==="teams"||table==="womens_teams"){
      const isWomen=table==="womens_teams"||url.searchParams.get("basketball_type")==="eq.womens";
      const list=(table==="teams"&&isWomen?[]:isWomen?women:men).map(t=>({...t,country:"Spain",city:"Madrid",league_name:isWomen?"Women Fixture League":"Men Fixture League",league_id:isWomen?wl:ml,website:null,logo_url:null}));
      const eq=url.searchParams.get("id");return json(eq?.startsWith("eq.")?list.find(t=>t.id===eq.slice(3))||null:list);
    }
    assert.ok(method==="GET"||url.pathname.includes("/rpc/"),"No unexpected writes");
    return json([]);
  });
  await context.addInitScript(({token,user,expires})=>{localStorage.setItem("sb-fixture-auth-token",JSON.stringify({access_token:token,refresh_token:"fixture",token_type:"bearer",expires_at:expires,user}));localStorage.setItem("hoopcheck:device-preferences:v1",JSON.stringify({appLock:false,haptics:false,onboardingDone:true}));},{token,user,expires});
  const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));
  for(const [path,name,other,side] of [["/teams/"+men[0].id,"Home Men","Away Men","mens"],["/leagues/"+ml,"Home Men","Away Men","mens"],["/womens/"+women[0].id,"Home Women","Away Women","womens"],["/womens/leagues/"+wl,"Home Women","Away Women","womens"]]){
    await page.goto(base+path);
    const schedule=page.getByTestId("entity-upcoming-games");
    const row=schedule.getByRole("button",{name:name+" versus "+other+", open game",exact:true});
    await row.waitFor();assert.equal(await schedule.getByRole("button",{name:/versus.*open game/}).count(),1);
    assert.equal(await page.getByTestId("native-page-header").count(),1);
    await row.click();await page.waitForURL(u=>u.pathname==="/fan-live"&&u.searchParams.get("side")===side&&u.searchParams.get("gameId")===(side==="mens"?id(1):id(2)));
    console.log("PASS "+theme+" "+path+" future-only schedule and native room deep link");
  }
  assert.deepEqual(errors,[]);
  await context.close();
 }} finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
