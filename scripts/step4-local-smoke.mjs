// Local HTTP route and anonymous access checks. No credentials or redirects are sent.
import { setTimeout as delay } from "node:timers/promises";
import { createServer } from "node:http";
import assert from "node:assert/strict";
const routes = [
  ...["/", "/login", "/directory", "/privacy", "/terms"].map(path => ({ path, status: 200, type: "text/html" })),
  ...["/reset-password", "/recover-password"].map(path => ({ path, status: 200, type: "text/html", noStore: true, recovery: true })),
  { path: "/api/app-version", status: 200, type: "application/json", noStore: true },
  ...["/api/mobile/bootstrap", "/api/mobile/workspaces?kind=owner", "/api/mobile/workspaces?kind=ambassador", "/api/admin/reviews", "/api/reviews/published"]
    .map(path => ({ path, status: 401, type: "application/json", noStore: true })),
];
async function probe(origin, { path, status: expected, type, noStore, recovery }) {
 const response=await fetch(origin+path,{redirect:"manual",signal:AbortSignal.timeout(5000)});
 const status=response.status;
 await response.body?.cancel();
 const contentType = response.headers.get("content-type")?.split(";")[0];
 const cacheControl = response.headers.get("cache-control")?.split(",").map(value => value.trim().toLowerCase());
 const ok = status === expected && contentType === type
   && (!noStore || cacheControl?.includes("no-store"))
   && (!recovery || response.headers.get("referrer-policy") === "no-referrer");
 return { path, status, ok: ok === true };
}
async function sweep(origin){
 const results=[];
 for (const route of routes) {
   try { results.push(await probe(origin, route)); }
   catch { results.push({ path: route.path, status: null, ok: false }); }
 }
 return results;
}
async function selfTest(){
 const server = createServer((req, res) => {
   const route = routes.find(entry => entry.path === req.url);
   assert.ok(route);
   const status = { "/privacy": 404, "/terms": 302, "/api/admin/reviews": 200 }[route.path] ?? route.status;
   res.setHeader("Content-Type", route.type);
   if (route.path === "/terms") res.setHeader("Location", "https://example.invalid/");
   if (route.noStore && route.path !== "/api/mobile/bootstrap") res.setHeader("Cache-Control", "private, no-store");
   if (route.recovery && route.path !== "/recover-password") res.setHeader("Referrer-Policy", "no-referrer");
   res.writeHead(status).end("fixture");
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 try {
   const result = await sweep("http://127.0.0.1:" + server.address().port);
   assert.deepEqual(result.filter(route => !route.ok).map(route => route.path),
     ["/privacy", "/terms", "/recover-password", "/api/mobile/bootstrap", "/api/admin/reviews"]);
   console.log("Local route probe fixture passed");
 } finally { await new Promise(resolve => server.close(resolve)); }
}
if(process.argv.length!==3||!["--self-test","--local"].includes(process.argv[2]))throw Error("Use --self-test or --local");
if(process.argv[2]==="--self-test")await selfTest();
else{
 const origin="http://127.0.0.1:3000";
 for(let n=0;n<15;n++){try{await probe(origin,routes[0]);break;}catch{if(n===14)throw Error("Local server unavailable");await delay(1000);}}
 const result=await sweep(origin);console.log(JSON.stringify(result));if(result.some(x=>!x.ok))process.exitCode=1;
}
