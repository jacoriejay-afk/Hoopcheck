// Local HTTP route availability only. No credentials, external requests or redirects.
import { setTimeout as delay } from "node:timers/promises";
import { createServer } from "node:http";
import assert from "node:assert/strict";
const routes=["/","/login","/directory","/privacy","/terms"];
async function probe(origin,path){
 const response=await fetch(origin+path,{redirect:"manual",signal:AbortSignal.timeout(5000)});
 const status=response.status;
 const type=response.headers.get("content-type")||"";
 await response.body?.cancel();
 return {path,status,ok:status===200&&type.includes("text/html")};
}
async function sweep(origin){
 const results=[];
 for(const path of routes){try{results.push(await probe(origin,path));}catch{results.push({path,status:null,ok:false});}}
 return results;
}
async function selfTest(){
 const server=createServer((req,res)=>{res.writeHead(req.url==="/privacy"?404:req.url==="/terms"?302:200,{"Content-Type":"text/html",Location:"https://example.invalid/"});res.end("fixture");});
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 try{const result=await sweep("http://127.0.0.1:"+server.address().port);assert.deepEqual(result.map(x=>x.ok),[true,true,true,false,false]);console.log("Local route probe fixture passed");}finally{await new Promise(resolve=>server.close(resolve));}
}
if(process.argv.length!==3||!["--self-test","--local"].includes(process.argv[2]))throw Error("Use --self-test or --local");
if(process.argv[2]==="--self-test")await selfTest();
else{
 const origin="http://127.0.0.1:3000";
 for(let n=0;n<15;n++){try{await probe(origin,"/");break;}catch{if(n===14)throw Error("Local server unavailable");await delay(1000);}}
 const result=await sweep(origin);console.log(JSON.stringify(result));if(result.some(x=>!x.ok))process.exitCode=1;
}
