import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseURL = process.env.RESPONSIVE_TEST_BASE_URL || "http://127.0.0.1:3000";
const out = "artifacts/responsive-layout";
await mkdir(out, { recursive: true });
const teamId = "11111111-1111-4111-8111-111111111111";
const teams = Array.from({ length: 6 }, (_, i) => ({
  id: i === 0 ? teamId : `22222222-2222-4222-8222-${String(i).padStart(12,"0")}`,
  name: ["Baku Basketball Club","Tbilisi Eagles","Prague Lions","Berlin Falcons","Lisbon Hoopers","Helsinki North"][i],
  country: ["Azerbaijan","Georgia","Czechia","Germany","Portugal","Finland"][i],
  city: ["Baku","Tbilisi","Prague","Berlin","Lisbon","Helsinki"][i],
  league_name: "National League", league_id: null, logo_url: null, active: true,
}));
let ready = false;
for (let i=0;i<60;i++) { try { const r=await fetch(baseURL); if(r.ok){ready=true;break;} } catch {} await new Promise(r=>setTimeout(r,1000)); }
assert.ok(ready, "Production server did not start.");
const browser = await chromium.launch({ channel:"chrome", headless:true, args:["--no-sandbox"] });
const results = [];
try {
  for (const width of [390,768,1280,1440,1920]) {
    const context = await browser.newContext({ viewport:{width,height:1000}, deviceScaleFactor:1, isMobile:width===390, hasTouch:width===390 });
    const page = await context.newPage();
    await page.route("https://ci.invalid/**", async route => {
      const req=route.request(), url=new URL(req.url()), path=url.pathname;
      const cors={"access-control-allow-origin":baseURL,"access-control-allow-credentials":"true","access-control-allow-methods":"GET,POST,PATCH,DELETE,OPTIONS","access-control-allow-headers":"authorization,apikey,content-type,prefer,accept,range,x-client-info","content-range":"0-5/6"};
      if(req.method()==="OPTIONS"){await route.fulfill({status:204,headers:cors,body:""});return;}
      let data=[];
      if(path.includes("/rest/v1/teams")) {
        if(url.searchParams.has("id")) data=teams.find(t=>url.searchParams.get("id")?.includes(t.id)) || teams[0];
        else data=teams;
      } else if(path.includes("/rest/v1/leagues")) data=[{id:"33333333-3333-4333-8333-333333333333",name:"National League",country:"Azerbaijan",level:"First Division"}];
      else if(path.includes("/rest/v1/team_league_memberships")) data=[];
      else if(path.includes("/rest/v1/coaches")) data=[];
      else if(path.includes("/rest/v1/profiles") || path.includes("/rest/v1/subscriptions")) data=null;
      else if(path.includes("/rest/v1/follow_relationships")) data=[];
      await route.fulfill({status:200,contentType:"application/json",headers:cors,body:JSON.stringify(data)});
    });
    const routePath="/teams";
    await page.goto(baseURL+routePath,{waitUntil:"domcontentloaded",timeout:30000});
    await page.locator("main.hc-team-directory-page").waitFor({state:"visible",timeout:30000});
    await page.waitForTimeout(800);
    const dir = await page.evaluate(() => {
      const main=document.querySelector("main.hc-team-directory-page");
      const grid=main?.querySelector(".hc-team-directory-list");
      const card=grid?.querySelector(".hc-team-directory-row");
      return {viewport:innerWidth, mainWidth:main?.getBoundingClientRect().width, mainPadding:getComputedStyle(main).paddingLeft, gridColumns:grid?getComputedStyle(grid).gridTemplateColumns.split(" ").length:0, cardCount:grid?.querySelectorAll(".hc-team-directory-row").length||0, scrollWidth:document.documentElement.scrollWidth, headline:getComputedStyle(main.querySelector("h1")).fontSize};
    });
    assert.ok(dir.mainWidth <= Math.min(width,1200)+1, `Main width exceeds viewport/container at ${width}: ${dir.mainWidth}`);
    assert.ok(dir.scrollWidth <= width+1, `Horizontal overflow at ${width}: ${dir.scrollWidth}`);
    const expected=width>=1200?3:width>=768?2:1;
    assert.equal(dir.gridColumns,expected,`Unexpected directory grid columns at ${width}`);
    if(width===390 || width===1440) await page.screenshot({path:`${out}/teams-${width}.png`,fullPage:true});
    results.push({page:"teams",...dir});
    await page.goto(baseURL+`/teams/${teamId}`,{waitUntil:"domcontentloaded",timeout:30000});
    await page.locator("main.hc-team-entity-profile").waitFor({state:"visible",timeout:30000});
    await page.waitForTimeout(500);
    const detail=await page.evaluate(()=> {
      const main=document.querySelector("main.hc-team-entity-profile");
      const hero=main?.querySelector(":scope > .hero");
      const roster=hero?.querySelector(".team-roster-spots");
      return {viewport:innerWidth,mainWidth:main?.getBoundingClientRect().width,scrollWidth:document.documentElement.scrollWidth,profileColumns:getComputedStyle(main).gridTemplateColumns,rosterVisible:!!roster && roster.getBoundingClientRect().width>0,factsVisible:!!hero?.querySelector(".hc-team-facts-card")};
    });
    assert.ok(detail.mainWidth <= Math.min(width,1200)+1, `Team page exceeds viewport/container at ${width}`);
    assert.ok(detail.scrollWidth <= width+1, `Team page horizontal overflow at ${width}`);
    if(width>=1024) assert.ok(detail.profileColumns.split(" ").length>=2,`Desktop team page should use two columns at ${width}`);
    if(width===390 || width===1440) await page.screenshot({path:`${out}/team-detail-${width}.png`,fullPage:true});
    results.push({page:"team-detail",...detail});
    await context.close();
  }
} finally { await browser.close(); }
console.log("RESPONSIVE_LAYOUT_RESULTS",JSON.stringify(results));
