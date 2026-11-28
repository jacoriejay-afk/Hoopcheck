import { MembershipExitFeedback } from "../components/MembershipExitFeedback";
import { MembershipPreview } from "../components/MembershipPreview";
import { Reveal } from "../components/Motion";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppState, Platform, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, GlassCard } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { useMfaSession } from "../src/native/mfa";
import { useStoreKit } from "../src/native/storekit";
import {usePlayMembershipRuntime} from "../src/native/usePlayMembershipRuntime";
import { appleProduct } from "../../../lib/billing/apple-products";
import { playReadOnlyNative } from "../modules/hoopcheck-play-billing";
import { parsePlayCatalog, type PlayCatalogRow } from "../../../lib/billing/play-catalog";
import { canPurchasePlayProduct, playProduct } from "../../../lib/billing/play-products";
import type { EffectiveMembership } from "../../../lib/billing/membership";
import type { PreparedPurchase, StoreProduct } from "../src/native/storekitClient";
const periods: Record<number, string> = { 1: "month", 6: "6 months", 12: "year" };
export default function MembershipScreen() {
  const router = useRouter();
  const android = Platform.OS === "android";
  // Deliberately development-only; a release binary cannot enable this via JS environment alone.
  const playDiagnostic = android && __DEV__ && process.env.EXPO_PUBLIC_HOOPCHECK_PLAY_CATALOG_DIAGNOSTIC === "true";
  const theme = useEntryTheme(), store = useStoreKit(), { account, retry } = useNativeAccount();
  const [products, setProducts] = useState<StoreProduct[]>([]), [membership, setMembership] = useState<EffectiveMembership | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const [prepared, setPrepared] = useState<PreparedPurchase | null>(null);
  const [playRows, setPlayRows] = useState<PlayCatalogRow[]>([]), [playNotice, setPlayNotice] = useState("");
  const playGeneration = useRef(0), playBusy = useRef(false);
  const playRuntime=usePlayMembershipRuntime();
  const [playPrepared,setPlayPrepared]=useState<PlayCatalogRow|null>(null),[playWorking,setPlayWorking]=useState(false),[playNeedsRestore,setPlayNeedsRestore]=useState(false);
  const security = useMfaSession();
  const owner = security.phase === "ready" ? security.owner : null;
  const playEnabled=android&&__DEV__&&playRuntime.available()&&Boolean(owner&&account?.user.id===owner);
  const identity = useRef(0);
  const generation = useRef(0), mounted = useRef(true), acting = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const listener = AppState.addEventListener("change", state => { if (state !== "active") { setPrepared(null); playGeneration.current++; setPlayRows([]); setPlayNotice(""); setPlayPrepared(null); playRuntime.invalidate(); } });
    return () => { mounted.current = false; listener.remove(); };
  }, [playRuntime]);
  const load = useCallback(async () => {
    const current = ++generation.current;
    if (!owner) { setLoading(false); return; }
    setLoading(true); setError(""); setMessage(""); setProducts([]); setPrepared(null); setMembership(null);
    const [status, catalog] = await Promise.allSettled([store.membership(), android ? Promise.resolve({products: [], canPurchase: false, reason: ""}) : store.catalog()]);
    if (!mounted.current || current !== generation.current) return;
    if (status.status === "fulfilled") setMembership(status.value);
    if (catalog.status === "fulfilled") { setProducts(status.status === "fulfilled" ? catalog.value.products : []); if (!catalog.value.canPurchase && !android) setMessage(catalog.value.reason); }
    else setError(catalog.reason instanceof Error ? catalog.reason.message : "Membership options are unavailable. Try again later.");
    if (status.status === "rejected" && catalog.status === "fulfilled") setError("Your current membership could not be verified. Refresh before purchasing.");
    setLoading(false);
  }, [store, owner, android]);
  useFocusEffect(useCallback(() => { void load(); return () => { generation.current++; playGeneration.current++; setPrepared(null); setPlayRows([]); setPlayNotice(""); setPlayPrepared(null); playRuntime.invalidate(); }; }, [load,playRuntime]));
  useLayoutEffect(() => { identity.current++; playGeneration.current++; setPlayRows([]); setPlayNotice(""); setPlayPrepared(null); setPlayNeedsRestore(false); setPrepared(null); setProducts([]); setMembership(null); setMessage(""); setError(""); }, [owner]);
  async function act(work: (live: () => boolean) => Promise<void>) {
    if (acting.current) return;
    const capturedIdentity = identity.current;
    const live = () => mounted.current && identity.current === capturedIdentity;
    acting.current = true; setBusy(true); setError(""); setMessage("");
    try { await work(live); }
    catch (value) { if (live()) setError(value instanceof Error ? value.message : "Apple could not complete this action. Try again."); }
    finally { acting.current = false; if (mounted.current) setBusy(false); }
  }
  async function checkPlayCatalog() {
    if (!(playDiagnostic||playEnabled) || !owner || account?.user.id !== owner || playBusy.current) return;
    const role = account.user.accountType;
    if (!["player","scout","agent","club_admin","coach","manager"].includes(role)) return;
    const captured = ++playGeneration.current;
    const live = () => mounted.current && captured === playGeneration.current;
    playBusy.current = true; setPlayRows([]); setPlayNotice("Checking Google Play catalog…");
    try {
      if (!playReadOnlyNative) throw Error("unavailable");
      const rows = parsePlayCatalog(await playReadOnlyNative.queryCatalog()).filter(row => {
        const product = playProduct(row.productId, row.basePlanId);
        return product !== null && canPurchasePlayProduct(role, product);
      });
      if (live()) { setPlayRows(rows); setPlayNotice(playEnabled?"Localized prices verified. Signed sandbox only; no live access is granted.":"Catalog verified on this device. Test preview only; purchasing is disabled."); }
    } catch { if (live()) setPlayNotice("Google Play catalog could not be verified on this device."); }
    finally { playBusy.current = false; }
  }
  const playAction=useCallback(async(work:(live:()=>boolean)=>Promise<void>)=>{
    if(!playEnabled||playBusy.current)return;
    const captured=playGeneration.current;
    const live=()=>mounted.current&&captured===playGeneration.current&&playRuntime.available();
    playBusy.current=true;setPlayWorking(true);
    try{await work(live);}catch{if(live())setPlayNotice("Google Play test verification is unavailable. Retry restoration.");}
    finally{playBusy.current=false;if(mounted.current)setPlayWorking(false);}
  },[playEnabled,playRuntime]);
  const recoverPlay=useCallback(async()=>{
    await playAction(async live=>{
      setPlayPrepared(null);setPlayNotice("Checking Google Play test purchases…");
      const result=await playRuntime.foreground();
      if(!live())return;
      setPlayNeedsRestore(!result||result.pending>0||result.failed>0);
      setPlayNotice(!result?"Purchase verification unavailable. Retry restoration.":result.pending?"Payment pending. No membership change confirmed.":result.failed?"Some purchases still need verification. Retry restoration.":result.verified?"Test purchase verified. Live membership unchanged.":"No restorable test purchases for this account.");
    });
  },[playAction,playRuntime]);
  useEffect(()=>{
    if(!playEnabled)return;
    const listener=playRuntime.subscribe(()=>{void recoverPlay();});
    const foreground=AppState.addEventListener("change",state=>{if(state==="active")void recoverPlay();});
    void recoverPlay();
    return()=>{listener.remove();foreground.remove();};
  },[playEnabled,playRuntime,recoverPlay]);
  async function reviewPlay(row:PlayCatalogRow){
    await playAction(async live=>{
      setPlayNotice("Verifying price and account…");
      const ready=await playRuntime.prepare(row);
      if(!live())return;
      if(ready){setPlayPrepared(row);setPlayNotice("");}
      else {setPlayPrepared(null);setPlayNotice("Purchase cannot be prepared. Refresh prices or retry restoration.");}
    });
  }
  async function confirmPlay(){
    await playAction(async live=>{
      setPlayPrepared(null);setPlayNotice("Waiting for Google Play…");
      const result=await playRuntime.launch();
      if(!live())return;
      setPlayNeedsRestore(result!=="cancelled");
      setPlayNotice(result==="cancelled"?"Test purchase cancelled. No membership change confirmed.":result==="launched"?"Waiting for payment verification. Restore if interrupted.":result==="restore_required"?"An existing purchase needs restoration.":"Purchase unavailable. Retry restoration before purchasing.");
    });
  }
  const text = { color: theme.foreground }, muted = { color: theme.muted };
  return <SafeAreaView edges={["left", "right", "bottom"]} style={{ flex: 1, backgroundColor: theme.background }}>
    <ScrollView contentContainerStyle={{ padding: 24, gap: 18, paddingBottom: 110 }}>
      <Text accessibilityRole="header" style={{ ...text, fontSize: 30, fontWeight: "900" }}>HoopCheck Membership</Text>
      <Reveal><GlassCard><Text style={{ ...text, fontSize: 21, fontWeight: "800" }}>{account?.tier === "premium" ? "Premium" : account?.tier === "pro" ? "Pro" : "Membership status"}</Text>
        <Text style={muted}>{membership ? `${membership.provider === "apple" ? "Apple" : membership.provider === "stripe" ? "Stripe" : "HoopCheck"} · ${membership.status.replaceAll("_", " ")}` : account?.hasPaidMembership ? "Active access verified by HoopCheck" : "Refresh to verify current membership"}</Text>
        {membership?.current_period_end ? <Text style={muted}>{membership.cancel_at_period_end ? "Access ends" : "Current period ends"} {new Date(membership.current_period_end).toLocaleDateString()}</Text> : null}
      </GlassCard></Reveal>
      <MembershipPreview />
      {loading ? <Text accessibilityRole="progressbar" style={muted}>{android ? "Checking membership…" : "Checking membership and Apple prices…"}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={text}>{error}</Text> : null}
      {message ? <Text accessibilityLiveRegion="polite" style={text}>{message}</Text> : null}
      {android ? <Text style={muted}>{playEnabled?"Google Play signed sandbox. No live membership changes.":"New Google Play purchases are not available in this release. Existing verified HoopCheck membership access is unchanged."}</Text> : !store.supported ? <Text style={muted}>Apple purchasing is not available on this device. Your existing membership stays unchanged.</Text> : null}
      {(playDiagnostic||playEnabled) && owner && account?.user.id === owner && ["player","scout","agent","club_admin","coach","manager"].includes(account.user.accountType) ? <GlassCard style={{ gap: 8 }}>
        <Text accessibilityRole="header" style={{ ...text, fontWeight: "800" }}>{playEnabled?"Google Play test membership":"Google Play catalog diagnostic"}</Text>
        <Text style={muted}>{playEnabled?"Signed sandbox only. No free trial or live membership grant.":"Development preview only. No purchase or restoration is available."}</Text>
        <Button secondary disabled={busy || loading || playWorking || playNotice === "Checking Google Play catalog…"} onPress={() => void checkPlayCatalog()}>Check Google Play catalog</Button>
        {playNotice ? <Text accessibilityLiveRegion="polite" style={muted}>{playNotice}</Text> : null}
        {playRows.map(row => <View key={row.productId + ":" + row.basePlanId}><Text style={text}>{playProduct(row.productId,row.basePlanId)?.plan === "premium" ? "Premium" : "Pro"} · {row.displayPrice} / {periods[playProduct(row.productId,row.basePlanId)?.months ?? 1]}</Text>{playEnabled&&!playPrepared?<Button disabled={busy||playWorking||playNeedsRestore} onPress={()=>void reviewPlay(row)}>{`Review Google Play ${playProduct(row.productId,row.basePlanId)?.plan==="premium"?"Premium":"Pro"}`}</Button>:null}</View>)}
        {playEnabled&&playPrepared?<GlassCard><Text style={text}>Confirm Google Play test purchase: {playPrepared.displayPrice} / {periods[playProduct(playPrepared.productId,playPrepared.basePlanId)?.months??1]}. No free trial.</Text><Button disabled={playWorking} onPress={()=>void confirmPlay()}>Confirm test purchase</Button><Button secondary disabled={playWorking} onPress={()=>{playRuntime.invalidate();setPlayPrepared(null);}}>Cancel test purchase</Button></GlassCard>:null}
        {playEnabled?<Button secondary disabled={playWorking} onPress={()=>void recoverPlay()}>Restore Google Play test purchases</Button>:null}
        {playEnabled&&playWorking?<Text accessibilityRole="progressbar" style={muted}>Verifying Google Play test purchase…</Text>:null}
      </GlassCard> : null}
      {account?.user.accountType === "fan" ? <Text style={muted}>No paid fan products are offered. Existing membership access and purchase restoration are preserved.</Text> : null}
      {!android && !prepared && account?.user.accountType !== "fan" ? products.map(product => <GlassCard key={product.id} style={{ gap: 10 }}>
        <Text accessibilityRole="header" style={{ ...text, fontSize: 21, fontWeight: "800" }}>{appleProduct(product.id)?.plan === "premium" ? "Premium" : "Pro"} · {periods[product.months]}</Text>
        <Text style={{ ...text, fontSize: 24, fontWeight: "800" }}>{product.displayPrice} / {periods[product.months]}</Text>
        <Text style={muted}>{appleProduct(product.id)?.plan === "premium" ? "Premium membership includes Pro benefits and eligible Premium tools for your account." : "Access HoopFeed, full reviews and eligible member tools for your account."} Existing role, verification and moderation rules apply.</Text>
        {product.trialDays ? <Text style={muted}>A 7-day free trial may be available for first-time payers who have not used a trial. Eligibility is checked before confirmation.</Text> : <Text style={muted}>No free trial. Billed every {periods[product.months]}.</Text>}
        <Button disabled={busy || loading || !account} onPress={() => void act(async live => { const value = await store.prepare(product); if (live()) setPrepared(value); })}>{`Review ${appleProduct(product.id)?.plan === "premium" ? "Premium" : "Pro"}`}</Button>
      </GlassCard>) : null}
      {!android && prepared ? <GlassCard style={{ gap: 12 }}>
        <Text accessibilityRole="header" style={{ ...text, fontSize: 22, fontWeight: "800" }}>Confirm your membership</Text>
        <Text style={text}>{prepared.hasTrial ? `7 days free, then ${prepared.product.displayPrice} every ${periods[prepared.product.months]}.` : `${prepared.product.displayPrice} every ${periods[prepared.product.months]}. No free trial.`}</Text>
        {prepared.trialEligibility === "unverified" ? <Text style={muted}>Trial eligibility could not be verified. This purchase is at the regular price without a free trial.</Text> : null}
        <Text style={muted}>Payment is charged to your Apple account. Your subscription renews automatically unless cancelled at least 24 hours before the current period ends. Manage or cancel in Apple subscriptions. A trial is available only once per user and only for first-time payers; Apple also checks eligibility for this subscription group.</Text>
        <Button disabled={busy || !account} onPress={() => void act(async live => {
          const result = await store.purchase(prepared);
          if (!live()) return;
          setPrepared(null);
          setMessage(result === "pending" ? "Apple is waiting for approval. Membership activates after the purchase is approved and verified." : result === "cancelled" ? "Purchase cancelled. No membership change was confirmed." : "Apple purchase synchronized. Refreshing your membership…");
          if (result === "purchased") { retry(); await load(); }
        })}>{busy ? "Waiting for Apple…" : prepared.hasTrial ? "Start 7-day free trial" : `Subscribe for ${prepared.product.displayPrice} / ${periods[prepared.product.months]}`}</Button>
        <Button secondary disabled={busy} onPress={() => setPrepared(null)}>Cancel</Button>
      </GlassCard> : null}
      <Button secondary disabled={busy || loading} onPress={() => { setMessage(""); void load(); }}>Refresh membership</Button>
      {!android && <Button secondary disabled={busy || !store.supported || !account} onPress={() => void act(async live => {
        setPrepared(null); const result = await store.restore(); if (!live()) return;
        retry(); await load();
        if (!live()) return;
        setMessage(result.failed ? "Some purchases still need verification. Please restore again." : result.restored ? `Verified ${result.restored} Apple purchase${result.restored === 1 ? "" : "s"}.` : result.foreign ? "These purchases belong to another HoopCheck account. Sign in to the original account to restore them." : "No restorable Apple purchases were found for this account.");
      })}>Restore purchases</Button>}
      {!android && <Button secondary disabled={busy || !store.supported || !account} onPress={() => void act(async live => { setPrepared(null); await store.manage(); if (live()) { retry(); await load(); } })}>Manage Apple subscription</Button>}
      {membership?.provider === "stripe" ? <><Text style={muted}>Your membership is billed through Stripe.</Text><Button secondary onPress={() => router.push({ pathname: "/account/support", params: { topic: "billing" } })}>Get billing help</Button></> : null}
      {process.env.EXPO_PUBLIC_HOOPCHECK_EXIT_FEEDBACK_ENABLED === "true" && owner && account?.user.id && membership && !loading ? <MembershipExitFeedback key={account.user.id} uid={account.user.id} /> : null}
      <View style={{ flexDirection: "row", gap: 18, flexWrap: "wrap" }}>
        <Button secondary onPress={() => router.push({pathname:"/legal",params:{document:"terms"}})}>Terms of use</Button>
        <Button secondary onPress={() => router.push({pathname:"/legal",params:{document:"privacy"}})}>Privacy policy</Button>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
