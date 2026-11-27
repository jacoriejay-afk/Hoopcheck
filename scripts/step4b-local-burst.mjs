// Bounded anonymous loopback burst. Not a production or capacity test.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {performance} from "node:perf_hooks";
const paths=["/","/login","/directory","/privacy","/terms"];
async function run(origin){
 const plan=Array.from({length:20},(_,i)=>paths[i%paths.length]);const results=[];
 async function worker(){while(plan.length){const path=plan.shift();const started=performance.now();let ok=false,status=null;try{const res=await fetch(origin+path,{redirect:"manual",signal:AbortSignal.timeout(5000)});status=res.status;ok=status===200&&(res.headers.get("content-type")||"").includes("text/html");await res.body?.cancel();}catch{}results.push({ok,status,ms:Math.round(performance.now()-started)});}}
 await Promise.all(Array.from({length:4},worker));const times=results.map(r=>r.ms).sort((a,b)=>a-b);
 return {requests:results.length,passed:results.filter(r=>r.ok).length,p95Ms:times[Math.ceil(times.length*.95)-1]};
}
if(process.argv.length!==3||!["--self-test","--local"].includes(process.argv[2]))throw Error("Use --self-test or --local");
if(process.argv[2]==="--self-test"){const server=createServer((req,res)=>{res.writeHead(req.url==="/terms"?503:200,{"Content-Type":"text/html"});res.end("fixture");});await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));try{const result=await run("http://127.0.0.1:"+server.address().port);assert.equal(result.requests,20);assert.equal(result.passed,16);console.log("Bounded burst fixture passed");}finally{await new Promise(resolve=>server.close(resolve));}}
else{const result=await run("http://127.0.0.1:3000");console.log(JSON.stringify(result));if(result.requests!==20||result.passed!==20)process.exitCode=1;}
