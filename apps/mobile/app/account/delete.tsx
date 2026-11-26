import { useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Input } from "../../src/primitives";
import { useEntryTheme } from "../../src/theme";
import { supabase } from "../../src/lib/supabase";
import { useNativeAccount } from "../../src/native/useNativeAccount";

export default function DeleteAccount() {
  const { account, loading } = useNativeAccount();
  const theme = useEntryTheme();
  if (!account) return <View style={{ flex: 1, backgroundColor: theme.background, padding: 24 }}>
    <Text style={{ color: theme.foreground }}>{loading ? "Verifying account…" : "Sign in and verify your account first."}</Text>
  </View>;
  return <DeletionForm key={account.user.id} owner={account.user.id} />;
}

function DeletionForm({ owner }: { owner: string }) {
  const theme = useEntryTheme(), router = useRouter();
  const [mode, setMode] = useState<"as_soon_as_possible" | "after_30_days">("as_soon_as_possible");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  const enabled = process.env.EXPO_PUBLIC_ACCOUNT_DELETION_ENABLED === "true";
  type RequestRecord = { id: string; status: string; scheduled_for: string };
  const [request, setRequest] = useState<RequestRecord | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const alive = useRef(false);
  const sequence = useRef(0);
  async function ownToken() {
    const before = await supabase.auth.getSession();
    const token = before.data.session?.access_token;
    if (before.error || !token || before.data.session?.user.id !== owner) throw Error("Your account changed. Sign in again.");
    const verified = await supabase.auth.getUser(token);
    const current = await supabase.auth.getSession();
    if (verified.error || verified.data.user?.id !== owner || current.error || current.data.session?.user.id !== owner || !alive.current) throw Error("Verify your account again.");
    return token;
  }
  async function ownRequest(path: string, init?: RequestInit) {
    const token = await ownToken();
    const origin = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim(), key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
    if (!origin || !key) throw Error("Service unavailable.");
    const url = new URL(origin);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw Error("Invalid service configuration.");
    const destination = new URL(path,url);
    if (destination.origin !== url.origin) throw Error("Invalid request.");
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(),15000);
    try {
      const response = await fetch(destination.href,{...init,cache:"no-store",redirect:"error",signal:ctrl.signal,
        headers:{Authorization:"Bearer "+token,apikey:key,"Content-Type":"application/json"}});
      if(!response.ok) throw Error(response.status===403?"Sign in again and verify your authenticator if enabled.":"Request could not be confirmed.");
      const body: unknown = await response.json();
      const after = await supabase.auth.getSession();
      if(!alive.current||after.error||after.data.session?.user.id!==owner)throw Error("Your account changed.");
      return body;
    } finally {clearTimeout(timer);}
  }
  async function refreshStatus() {
    const revision=++sequence.current;
    if(alive.current){setStatusLoading(true);setStatusError(false);}
    try {
      const params=new URLSearchParams({select:"id,status,scheduled_for",user_id:"eq."+owner,status:"in.(pending,processing,failed)",order:"requested_at.desc",limit:"1"});
      const result=await ownRequest("/rest/v1/account_deletion_requests?"+params.toString());
      if(!Array.isArray(result)||result.length>1)throw Error("Unexpected request status.");
      const row=result[0];
      if(row&&(!/^[0-9a-f-]{36}$/i.test(row.id)||!["pending","processing","failed"].includes(row.status)||typeof row.scheduled_for!=="string"||!Number.isFinite(Date.parse(row.scheduled_for))))throw Error("Unexpected request status.");
      if(alive.current&&revision===sequence.current)setRequest(row??null);
    }catch{if(alive.current&&revision===sequence.current){setRequest(null);setStatusError(true);}}
    finally{if(alive.current&&revision===sequence.current)setStatusLoading(false);}
  }
  useEffect(()=>{
    alive.current=true;
    if(enabled)void refreshStatus();
    return()=>{alive.current=false;sequence.current++;};
    // The keyed form remounts on account changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[owner,enabled]);
  async function cancelRequest() {
    if(!enabled||submitting.current||request?.status!=="pending")return;
    submitting.current=true;setBusy(true);setMessage("");
    try{
      const result=await ownRequest("/rest/v1/rpc/cancel_verified_account_deletion_request",{method:"POST",body:JSON.stringify({p_request:request.id})});
      if(result!==true)throw Error("This request can no longer be cancelled. Refresh its status.");
      if(alive.current)setMessage("Deletion request cancelled.");
    }catch(error){if(alive.current)setMessage(error instanceof Error?error.message:"Cancellation could not be confirmed.");}
    finally{if(alive.current){await refreshStatus();setBusy(false);}submitting.current=false;}
  }
  async function submit() {
    if (!enabled || submitting.current || statusLoading || statusError || (request && request.status !== "pending") || confirmation !== "DELETE") return;
    submitting.current = true; setBusy(true); setMessage("");
    try {
      const before = await supabase.auth.getSession();
      const token = before.data.session?.access_token;
      if (before.error || !token || before.data.session?.user.id !== owner) throw Error("Your account changed. Sign in again.");
      const verified = await supabase.auth.getUser(token);
      const current = await supabase.auth.getSession();
      if (verified.error || verified.data.user?.id !== owner || current.error || current.data.session?.user.id !== owner) throw Error("Verify your account again.");
      const url = new URL(process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim() || "https://hoopcheck.online");
      if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw Error("Invalid service configuration.");
      url.pathname = "/api/account/deletion-request";
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
      try {
        const result = await fetch(url.href, { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "DELETE", mode }), signal: controller.signal, redirect: "error" });
        const response = await result.json();
        const after = await supabase.auth.getSession();
        if (after.error || after.data.session?.user.id !== owner) return;
        if (!result.ok || result.status !== 202 || typeof response.requestId !== "string") {
          if (result.status === 403) throw Error("Sign in again with your original login method and verify your authenticator, if enabled. Then return to this page.");
          throw Error("The request was not confirmed. Try again.");
        }
        setConfirmation("");
        setMessage("Deletion request recorded. Your account has not been deleted yet. Reference: " + response.requestId + ". Status: " + response.status + ".");
        await refreshStatus();
      } finally { clearTimeout(timer); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to confirm request. Try again."); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 14 }}>
    <Text accessibilityRole="header" style={{ color: theme.foreground, fontFamily: "HoopCheckDisplay", fontSize: 26 }}>Delete account</Text>
    <Text style={{ color: theme.foreground }}>Account deletion is different from signing out or hiding your profile. Once completed, your account and personal information will be removed except where lawful retention applies.</Text>
    <Text style={{ color: theme.muted }}>Deleting your account does not automatically stop an Apple subscription. Manage your subscriptions separately to prevent future charges.</Text>
    <Button secondary onPress={() => router.push("/membership")}>Manage membership</Button>
    {enabled ? <>
      {statusLoading ? <Text style={{color:theme.muted}}>Checking deletion request status…</Text> : statusError ? <Text style={{color:theme.muted}}>Could not verify request status. Refresh before submitting.</Text> : request ? <View style={{gap:8}}>
        <Text style={{color:theme.foreground,fontWeight:"700"}}>Request status: {request.status}</Text>
        <Text style={{color:theme.muted}}>Scheduled processing: {new Date(request.scheduled_for).toLocaleString()}. This is not a completion date.</Text>
        {request.status==="pending" ? <Button secondary disabled={busy} onPress={()=>void cancelRequest()}>Cancel pending deletion request</Button> : null}
      </View> : <Text style={{color:theme.muted}}>No active deletion request.</Text>}
      <Button secondary disabled={busy||statusLoading} onPress={()=>void refreshStatus()}>Refresh request status</Button>
      <Text style={{ color: theme.foreground, fontWeight: "700" }}>When should processing begin?</Text>
      <Button secondary disabled={busy} onPress={() => setMode("as_soon_as_possible")}>{mode === "as_soon_as_possible" ? "✓ " : ""}As soon as possible</Button>
      <Button secondary disabled={busy} onPress={() => setMode("after_30_days")}>{mode === "after_30_days" ? "✓ " : ""}After 30 days</Button>
      <Text style={{ color: theme.muted }}>A request is not a completed deletion. Processing and legally required retention may take time. You may need to sign in again before submitting.</Text>
      <Input accessibilityLabel="Type DELETE to confirm" placeholder="Type DELETE" autoCapitalize="characters" autoCorrect={false} value={confirmation} onChangeText={setConfirmation} editable={!busy} />
      <Button disabled={busy || statusLoading || statusError || Boolean(request && request.status !== "pending") || confirmation !== "DELETE"} onPress={() => void submit()}>{busy ? "Submitting…" : "Request account deletion"}</Button>
    </> : <Text style={{ color: theme.muted }}>Account deletion is currently unavailable. No account or subscription changes have been made.</Text>}
    {message ? <Text accessibilityRole="alert" style={{ color: theme.foreground }}>{message}</Text> : null}
  </ScrollView>;
}
