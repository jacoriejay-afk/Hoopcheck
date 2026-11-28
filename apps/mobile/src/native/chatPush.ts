import type {SupabaseClient} from "@supabase/supabase-js";
import {verifiedAlertSession} from "./notifications.ts";
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export async function readChatPushPreference(client:SupabaseClient,owner:string,enabled:boolean|null,signal:AbortSignal){
 const scope=await verifiedAlertSession(client,signal,owner);
 const result=await client.rpc("my_chat_push_preference",{p_enabled:enabled}).setHeader("Authorization",scope.bearer).abortSignal(signal);
 if(result.error||signal.aborted||typeof result.data!=="boolean"||enabled!==null&&result.data!==enabled)throw Error("Push preference unavailable.");
 const after=await verifiedAlertSession(client,signal,owner);
 if(after.bearer!==scope.bearer)throw Error("Session changed.");
 return result.data as boolean;
}
export async function syncChatPushDevice(client:SupabaseClient,owner:string,installation:string,device:{platform:"ios"|"android";token:string}|null,signal:AbortSignal){
 if(!uuid.test(installation)||device!==null&&(!["ios","android"].includes(device.platform)||!/^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]{16,256}\]$/.test(device.token)))throw Error("Invalid registration.");
 const scope=await verifiedAlertSession(client,signal,owner);
 const r=await client.rpc("my_chat_push_device",{p_installation:installation,p_platform:device?.platform??null,p_token:device?.token??null,p_revoke:device===null}).setHeader("Authorization",scope.bearer).abortSignal(signal);
 if(r.error||signal.aborted||r.data!==true)throw Error("Push registration could not be confirmed.");
 const after=await verifiedAlertSession(client,signal,owner);
 if(after.bearer!==scope.bearer)throw Error("Session changed.");
}
