import { useEffect, useState } from "react";
import { Linking, ScrollView, Share, Text, View } from "react-native";
import { Button } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { useActiveScreen } from "../src/native/useActiveScreen";
import { useNetwork } from "../src/native/network";
import { readWithDeadline } from "../src/native/readDeadline";
import { readWorkspace, type Workspace, type WorkspaceKind } from "../src/native/workspaceClient";
import { supabase } from "../src/lib/supabase";
const origin=process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim()||"https://hoopcheck.online";
function money(amount:number|null|undefined,currency="USD") {
  if(typeof amount!=="number"||!Number.isFinite(amount))return "Unavailable";
  try{return new Intl.NumberFormat("en-US",{style:"currency",currency}).format(amount/100);}catch{return "Unavailable";}
}
function date(value:string|null){return value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleDateString():"Pending";}
export function PrivateWorkspace({kind}:{kind:WorkspaceKind}) {
  const t=useEntryTheme(),{account,loading,retry}=useNativeAccount(),active=useActiveScreen(),{offline}=useNetwork();
  const owner=account?.user.id,allowed=Boolean(owner&&account?.workspaces?.[kind]===true&&!offline);
  const [state,setState]=useState<{owner:string;data:Workspace|null;error:string}|null>(null);
  const [refresh,setRefresh]=useState(0);
  const [linkError,setLinkError]=useState("");
  useEffect(()=>{setLinkError("");},[owner,kind,allowed,active]);
  useEffect(()=>{
    if(!active||!allowed||!owner){setState(null);return;}
    const controller=new AbortController(),deadline=setTimeout(()=>controller.abort(),25000);
    let live=true;setState(null);
    async function load(){
      try{
        const session=await readWithDeadline(()=>supabase.auth.getSession());
        if(session.error||!session.data.session||session.data.session.user.id!==owner||!owner)throw Error("Verify your account again.");
        const data=await readWorkspace(origin,session.data.session.access_token,owner,kind,controller.signal);
        const after=await readWithDeadline(()=>supabase.auth.getSession());
        if(after.error||after.data.session?.user.id!==owner)throw Error("Account changed.");
        if(live)setState({owner,data,error:""});
      }catch(e){if(live&&owner)setState({owner,data:null,error:e instanceof Error?e.message:"Workspace unavailable."});}
      finally{clearTimeout(deadline);}
    }
    void load();return()=>{live=false;clearTimeout(deadline);controller.abort();};
  },[active,allowed,owner,kind,refresh]);
  const current=active&&allowed&&state?.owner===owner&&(!state.data||state.data.kind===kind)?state:null,data=current?.data;
  async function openAdmin(path:"/admin/directory"|"/admin/ambassadors"|"/admin/reviews") {
    if(!active||!allowed||kind!=="owner"||data?.kind!=="owner"||data.owner!==owner)return;
    setLinkError("");
    try {
      const session=await readWithDeadline(()=>supabase.auth.getSession());
      if(session.error||session.data.session?.user.id!==owner)throw Error("Verify your account again.");
      await Linking.openURL("https://hoopcheck.online"+path);
    }catch{setLinkError("Could not open administration. Verify your account and try again.");}
  }
  const title={color:t.foreground,fontFamily:"HoopCheckDisplay",fontSize:23},body={color:t.foreground,fontSize:14},muted={color:t.muted,fontSize:12,lineHeight:18};
  const row=(label:string,value:string|number)=><View key={label} style={{flexDirection:"row",alignItems:"center",gap:10,paddingVertical:10,borderBottomWidth:1,borderColor:t.border}}>
    <Text style={{...muted,flex:1}}>{label}</Text><Text style={{...body,fontWeight:"700",maxWidth:"48%"}}>{value}</Text></View>;
  return <ScrollView style={{flex:1,backgroundColor:t.background}} contentContainerStyle={{padding:12,gap:12}}>
    {loading?<Text accessibilityRole="progressbar" style={muted}>Verifying access…</Text>:!allowed?<><Text style={body}>{offline?"Reconnect to verify workspace access.":"This private workspace is not available to your account."}</Text><Button secondary onPress={retry}>Verify access</Button></>:!current?<Text accessibilityRole="progressbar" style={muted}>Loading private workspace…</Text>:current.error?<Text accessibilityRole="alert" style={body}>{current.error}</Text>:null}
    {data?.kind==="owner"?<>
      <Text accessibilityRole="header" style={title}>PLATFORM METRICS</Text>{data.metrics.map(m=>row(m.label,m.value))}
      <Text accessibilityRole="header" style={title}>STRIPE ACTIVITY</Text>
      {data.stripe.error?<Text style={muted}>Stripe reporting unavailable. No financial totals shown.</Text>:<>
        {row("Paid USD invoices (30 days)",data.stripe.paidInvoices)}
        {row("Active Stripe subscriptions",data.stripe.activeSubscriptions??"Unavailable")}
        {row("Gross paid invoice volume",money(data.stripe.grossPaidMinor))}
        {row("Successful USD refunds (30 days)",money(data.stripe.refundedMinor))}
        {data.stripe.incomplete||data.stripe.subscriptionsIncomplete||data.stripe.refundsIncomplete?<Text style={muted}>Partial results: reporting limit reached.</Text>:null}
        <Text style={muted}>Gross invoices by creation date, before fees, taxes and refunds. Refunds use refund creation date; these figures do not calculate net revenue or MRR.</Text>
      </>}
      <Text style={muted}>Read-only overview. No payment, role or payout changes are performed here.</Text>
      <Text accessibilityRole="header" style={title}>ADMINISTRATION</Text>
      <Text style={muted}>Management opens the secured HoopCheck website in your browser. Sign in there and complete any required security verification. No app session is transferred.</Text>
      <Button secondary onPress={()=>void openAdmin("/admin/directory")}>Admin Control Center (web)</Button>
      <Button secondary onPress={()=>void openAdmin("/admin/reviews")}>Review moderation (web)</Button>
      <Button secondary onPress={()=>void openAdmin("/admin/ambassadors")}>Ambassador administration (web)</Button>
      {linkError?<Text accessibilityRole="alert" style={body}>{linkError}</Text>:null}
    </>:data?.kind==="ambassador"?<>
      <Text accessibilityRole="header" style={title}>CAMPAIGN</Text><Text style={body}>{data.dashboard.active?"Active campaign":data.dashboard.status}</Text>
      {row("Referral visits",data.dashboard.clicks)}{row("Verified signups",data.dashboard.signups)}{row("Paid conversions",data.dashboard.conversions)}
      {data.dashboard.totals.map(v=>row("Commission earnings · "+v.currency,money(v.earned,v.currency)))}
      {data.dashboard.active&&/^[A-Za-z0-9_-]{1,64}$/.test(data.dashboard.code)?<>
        {row("Referral code",data.dashboard.code)}
        <Button onPress={()=>{void Share.share({message:"https://hoopcheck.online/referral/"+data.dashboard.code}).catch(()=>{});}}>Share referral link</Button>
      </>:null}
      <Text accessibilityRole="header" style={title}>RECENT REFERRALS</Text>
      {data.dashboard.referrals.length?data.dashboard.referrals.map(v=>row("Referral "+v.id.slice(0,8)+" · "+date(v.captured_at),v.stripe_status||"Signed up")):<Text style={muted}>No verified signups yet.</Text>}
      <Text accessibilityRole="header" style={title}>COMMISSIONS</Text>
      {data.dashboard.commissions.length?data.dashboard.commissions.map(v=>row(date(v.paid_invoice_at)+" · "+v.subscription_plan+" · "+v.commission_rate_bps/100+"% · "+v.status,money(v.earnings,v.currency))):<Text style={muted}>No commissions yet.</Text>}
      <Text accessibilityRole="header" style={title}>PAYMENT HISTORY</Text>
      {data.dashboard.payouts.length?data.dashboard.payouts.map(v=>row(date(v.paid_at||v.approved_at)+" · "+v.status,money(v.amount_minor,v.currency))):<Text style={muted}>No payments recorded yet.</Text>}
    </>:null}
    {allowed?<Button secondary onPress={()=>setRefresh(v=>v+1)}>Refresh workspace</Button>:null}
  </ScrollView>;
}
