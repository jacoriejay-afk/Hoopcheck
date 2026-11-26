import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { exchangeAppleAuthorization, encryptAppleToken, type AppleJwk } from "../../../../lib/server/apple-sign-in-authorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const fail = (status: number) => NextResponse.json({ error: "Apple authorization could not be confirmed." }, { status, headers });
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (process.env.APPLE_SIGN_IN_AUTHORIZATION_ENABLED !== "true") return fail(503);
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return fail(401);
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, service=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const teamId=process.env.APPLE_SIGN_IN_TEAM_ID, keyId=process.env.APPLE_SIGN_IN_KEY_ID, privateKey=process.env.APPLE_SIGN_IN_PRIVATE_KEY, encryptionKey=process.env.APPLE_AUTHORIZATION_VAULT_KEY;
  if (!url||!key||!service||!teamId||!keyId||!privateKey||!encryptionKey) return fail(503);
  try {
    const reader=request.body?.getReader(); if (!reader) return fail(400);
    const chunks: Uint8Array[]=[]; let total=0;
    for (;;) {
      const part=await reader.read(); if(part.done) break;
      total+=part.value.byteLength;
      if(total>24576){await reader.cancel();return fail(413);}
      chunks.push(part.value);
    }
    const body: unknown=JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if(!body||typeof body!=="object"||Array.isArray(body))return fail(400);
    const b=body as Record<string,unknown>;
    if(Object.keys(b).some(k=>!["code","identityToken","rawNonce"].includes(k))||
       typeof b.code!=="string"||!b.code||b.code.length>4096||
       typeof b.identityToken!=="string"||b.identityToken.length>16000||
       typeof b.rawNonce!=="string"||! /^[a-f0-9]{64}$/.test(b.rawNonce))return fail(400);
    const auth=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const verified=await auth.auth.getUser(token);
    const user=verified.data.user;
    if(verified.error||!user||!uuid.test(user.id)||!user.email_confirmed_at)return fail(401);
    const claims=await auth.auth.getClaims(token), c=claims.data?.claims;
    if(claims.error||!c||c.sub!==user.id||!["authenticated","hoopcheck_pending_signup"].includes(String(c.role))||
       typeof c.session_id!=="string"||!uuid.test(c.session_id)||c.is_anonymous===true||c.client_id)return fail(401);
    const identities=(user.identities??[]).filter(i=>i.provider==="apple");
    if(identities.length!==1)return fail(403);
    const subject=identities[0].identity_data?.sub;
    if(typeof subject!=="string"||!subject||subject.length>255)return fail(403);
    const jwks=await fetch("https://appleid.apple.com/auth/keys",{cache:"no-store",redirect:"error",signal:AbortSignal.timeout(10000)});
    if(!jwks.ok)return fail(503);
    const keys=(await jwks.json())?.keys as AppleJwk[];
    if(!Array.isArray(keys)||keys.length>32)return fail(503);
    const refresh=await exchangeAppleAuthorization({code:b.code,identityToken:b.identityToken,rawNonce:b.rawNonce,subject},keys,{teamId,keyId,privateKey});
    const envelope=encryptAppleToken(refresh,user.id,subject,encryptionKey);
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const result=await admin.rpc("store_verified_apple_authorization",{p_owner:user.id,p_session:c.session_id,p_subject:subject,p_envelope:envelope});
    if(result.error||result.data!==true)return fail(503);
    return NextResponse.json({stored:true},{headers});
  } catch {return fail(503);}
}
