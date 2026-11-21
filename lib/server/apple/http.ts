import { NextResponse } from "next/server";
import { AppleBillingError } from "./proofs";
export function appleReply(body:unknown,status=200){return NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});}
export function appleFailure(error:unknown){
  return error instanceof AppleBillingError?appleReply({error:error.message,code:error.code},error.status):appleReply({error:"Apple membership verification is unavailable. Your existing memberships have not been changed.",code:"apple_unavailable"},503);
}
export async function appleJson(request:Request):Promise<Record<string,unknown>>{
  const limit=72*1024;
  if(Number(request.headers.get("content-length"))>limit)throw new AppleBillingError("request_too_large",413,"Purchase verification is too large.");
  const reader=request.body?.getReader();if(!reader)throw new AppleBillingError("invalid_request",400,"Purchase verification is missing.");
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new AppleBillingError("request_too_large",413,"Purchase verification is too large.");}chunks.push(value);}}
  finally{reader.releaseLock();}
  try{const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}const value=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));if(!value || typeof value!=="object" || Array.isArray(value))throw Error();return value;}
  catch{throw new AppleBillingError("invalid_request",400,"Purchase verification is invalid.");}
}
