import { MembershipPreview } from "../components/MembershipPreview";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppState, Linking, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, GlassCard } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { useMfaSession } from "../src/native/mfa";
import { useStoreKit } from "../src/native/storekit";
import { appleProduct } from "../../../lib/billing/apple-products";
import type { EffectiveMembership } from "../../../lib/billing/membership";
import type { PreparedPurchase, StoreProduct } from "../src/native/storekitClient";
const periods: Record<number, string> = { 1: "month", 6: "6 months", 12: "year" };
export default function MembershipScreen() {
  const theme = useEntryTheme(), store = useStoreKit(), { account, retry } = useNativeAccount();
  const [products, setProducts] = useState<StoreProduct[]>([]), [membership, setMembership] = useState<EffectiveMembership | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const [prepared, setPrepared] = useState<PreparedPurchase | null>(null);
  const security = useMfaSession();
  const owner = security.phase === "ready" ? security.owner : null;
  const identity = useRef(0);
  const generation = useRef(0), mounted = useRef(true), acting = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const listener = AppState.addEventListener("change", state => { if (state !== "active") setPrepared(null); });
    return () => { mounted.current = false; listener.remove(); };
  }, []);
  const load = useCallback(async () => {
    const current = ++generation.current;
    if (!owner) { setLoading(false); return; }
    setLoading(true); setError(""); setMessage(""); setProducts([]); setPrepared(null); setMembership(null);
    const [status, catalog] = await Promise.allSettled([store.membership(), store.catalog()]);
    if (!mounted.current || current !== generation.current) return;
    if (status.status === "fulfilled") setMembership(status.value);
    if (catalog.status === "fulfilled") { setProducts(status.status === "fulfilled" ? catalog.value.products : []); if (!catalog.value.canPurchase) setMessage(catalog.value.reason); }
    else setError(catalog.reason instanceof Error ? catalog.reason.message : "Membership options are unavailable. Try again later.");
    if (status.status === "rejected" && catalog.status === "fulfilled") setError("Your current membership could not be verified. Refresh before purchasing.");
    setLoading(false);
  }, [store, owner]);
  useFocusEffect(useCallback(() => { void load(); return () => { generation.current++; setPrepared(null); }; }, [load]));
  useLayoutEffect(() => { identity.current++; setPrepared(null); setProducts([]); setMembership(null); setMessage(""); setError(""); }, [owner]);
  async function act(work: (live: () => boolean) => Promise<void>) {
    if (acting.current) return;
    const capturedIdentity = identity.current;
    const live = () => mounted.current && identity.current === capturedIdentity;
    acting.current = true; setBusy(true); setError(""); setMessage("");
    try { await work(live); }
    catch (value) { if (live()) setError(value instanceof Error ? value.message : "Apple could not complete this action. Try again."); }
    finally { acting.current = false; if (mounted.current) setBusy(false); }
  }
  const text = { color: theme.foreground }, muted = { color: theme.muted };
  return <SafeAreaView edges={["left", "right", "bottom"]} style={{ flex: 1, backgroundColor: theme.background }}>
    <ScrollView contentContainerStyle={{ padding: 24, gap: 18, paddingBottom: 110 }}>
      <Text accessibilityRole="header" style={{ ...text, fontSize: 30, fontWeight: "900" }}>HoopCheck Membership</Text>
      <GlassCard><Text style={{ ...text, fontSize: 21, fontWeight: "800" }}>{account?.tier === "premium" ? "Premium" : account?.tier === "pro" ? "Pro" : "Membership status"}</Text>
        <Text style={muted}>{membership ? `${membership.provider === "apple" ? "Apple" : membership.provider === "stripe" ? "Stripe" : "HoopCheck"} · ${membership.status.replaceAll("_", " ")}` : account?.hasPaidMembership ? "Active access verified by HoopCheck" : "Refresh to verify current membership"}</Text>
        {membership?.current_period_end ? <Text style={muted}>{membership.cancel_at_period_end ? "Access ends" : "Current period ends"} {new Date(membership.current_period_end).toLocaleDateString()}</Text> : null}
      </GlassCard>
      <MembershipPreview />
      {loading ? <Text accessibilityRole="progressbar" style={muted}>Checking membership and Apple prices…</Text> : null}
      {error ? <Text accessibilityRole="alert" style={text}>{error}</Text> : null}
      {message ? <Text accessibilityLiveRegion="polite" style={text}>{message}</Text> : null}
      {!store.supported ? <Text style={muted}>Apple purchasing is available in the next supported iPhone release. Your existing membership stays unchanged.</Text> : null}
      {account?.user.accountType === "fan" ? <Text style={muted}>No paid fan products are offered. Existing membership access and purchase restoration are preserved.</Text> : null}
      {!prepared && account?.user.accountType !== "fan" ? products.map(product => <GlassCard key={product.id} style={{ gap: 10 }}>
        <Text accessibilityRole="header" style={{ ...text, fontSize: 21, fontWeight: "800" }}>{appleProduct(product.id)?.plan === "premium" ? "Premium" : "Pro"} · {periods[product.months]}</Text>
        <Text style={{ ...text, fontSize: 24, fontWeight: "800" }}>{product.displayPrice} / {periods[product.months]}</Text>
        <Text style={muted}>{appleProduct(product.id)?.plan === "premium" ? "Premium membership includes Pro benefits and eligible Premium tools for your account." : "Access HoopFeed, full reviews and eligible member tools for your account."} Existing role, verification and moderation rules apply.</Text>
        {product.trialDays ? <Text style={muted}>A 7-day free trial may be available for first-time payers who have not used a trial. Eligibility is checked before confirmation.</Text> : <Text style={muted}>No free trial. Billed every {periods[product.months]}.</Text>}
        <Button disabled={busy || loading || !account} onPress={() => void act(async live => { const value = await store.prepare(product); if (live()) setPrepared(value); })}>{`Review ${appleProduct(product.id)?.plan === "premium" ? "Premium" : "Pro"}`}</Button>
      </GlassCard>) : null}
      {prepared ? <GlassCard style={{ gap: 12 }}>
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
      <Button secondary disabled={busy || !store.supported || !account} onPress={() => void act(async live => {
        setPrepared(null); const result = await store.restore(); if (!live()) return;
        retry(); await load();
        if (!live()) return;
        setMessage(result.failed ? "Some purchases still need verification. Please restore again." : result.restored ? `Verified ${result.restored} Apple purchase${result.restored === 1 ? "" : "s"}.` : result.foreign ? "These purchases belong to another HoopCheck account. Sign in to the original account to restore them." : "No restorable Apple purchases were found for this account.");
      })}>Restore purchases</Button>
      <Button secondary disabled={busy || !store.supported || !account} onPress={() => void act(async live => { setPrepared(null); await store.manage(); if (live()) { retry(); await load(); } })}>Manage Apple subscription</Button>
      {membership?.provider === "stripe" ? <Text style={muted}>Your membership is billed through Stripe. Manage it securely on the HoopCheck website; Apple controls do not cancel Stripe billing.</Text> : null}
      <View style={{ flexDirection: "row", gap: 18, flexWrap: "wrap" }}>
        <Button secondary onPress={() => void Linking.openURL("https://hoopcheck.online/terms").catch(() => setError("Could not open the terms. Try again."))}>Terms of use</Button>
        <Button secondary onPress={() => void Linking.openURL("https://hoopcheck.online/privacy").catch(() => setError("Could not open privacy policy. Try again."))}>Privacy policy</Button>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
