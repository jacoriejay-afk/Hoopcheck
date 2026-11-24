import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { GlassCard } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { useActiveScreen } from "../src/native/useActiveScreen";
import { useNetwork } from "../src/native/network";
import { readWithDeadline } from "../src/native/readDeadline";
import { supabase } from "../src/lib/supabase";
import { readTrustIndex, type TrustEntity, type TrustIndex } from "../src/native/trustIndex";

const origin = process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim() || "https://hoopcheck.online";
type Receipt = { scope: string; value: TrustIndex | "error" };
export function TeamTrustIndex({ id, entity, refresh }: { id: string; entity: TrustEntity; refresh: number }) {
  const theme = useEntryTheme();
  const { account, loading } = useNativeAccount();
  const { offline, revision } = useNetwork();
  const focused = useActiveScreen();
  const [authRevision, setAuthRevision] = useState(0);
  const generation = useRef(0);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const uid = account?.user.id;
  const scope = JSON.stringify([uid, account?.user.accountType, account?.tier, account?.hasPaidMembership, entity, id, refresh, revision, authRevision]);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(() => {
      generation.current++;
      setReceipt(null);
      setAuthRevision(value => value + 1);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let live = true;
    const epoch = generation.current;
    const controller = new AbortController();
    setReceipt(null);
    if (!uid || offline || loading || !focused) return;
    const timeout = setTimeout(() => {
      controller.abort();
      if (live && generation.current === epoch) setReceipt({ scope, value: "error" });
    }, 10000);
    void (async () => {
      try {
        const session = await readWithDeadline(() => supabase.auth.getSession());
        if (session.error || session.data.session?.user.id !== uid) throw new Error("Account changed");
        const token = session.data.session.access_token;
        const value = await readTrustIndex(origin, token, entity, id, controller.signal);
        const current = await readWithDeadline(() => supabase.auth.getSession());
        if (current.error || current.data.session?.user.id !== uid || current.data.session.access_token !== token) throw new Error("Account changed");
        if (live && generation.current === epoch && !controller.signal.aborted) setReceipt({ scope, value });
      } catch {
        if (live && generation.current === epoch) setReceipt({ scope, value: "error" });
      } finally { clearTimeout(timeout); }
    })();
    return () => { live = false; controller.abort(); clearTimeout(timeout); };
  }, [uid, offline, loading, focused, scope, id, entity]);
  const value = !offline && !loading && focused && receipt?.scope === scope ? receipt.value : null;
  const label = offline ? "Reconnect to verify access." : loading ? "Checking access…" :
    !uid ? "Sign in or refresh your account to verify Trust Index access." : !value ? "Checking access…" :
    value === "error" ? "Trust Index unavailable. Pull to refresh." :
    value.status === "locked" ? "Trust Index access follows your HoopCheck membership." :
    value.score === null ? "Not enough approved review data for a score." : null;
  return <GlassCard style={{ marginTop: 8, gap: 8 }}>
    <Text accessibilityRole="header" style={{ color: theme.foreground, fontSize: 20, fontWeight: "800" }}>Team Trust Index</Text>
    {label ? <Text style={{ color: theme.muted, fontSize: 13 }}>{label}</Text> : null}
    {value && value !== "error" && value.status === "available" && value.score !== null ? <View style={{ gap: 6 }}>
      <Text accessibilityLabel={value.score + " out of 100"} style={{ color: theme.accent, fontSize: 30, fontWeight: "900" }}>{value.score}/100</Text>
      <Text style={{ color: theme.foreground, fontSize: 13 }}>{value.verified} verified player reviews out of {value.reviews} approved reviews</Text>
    </View> : null}
    <Text style={{ color: theme.muted, fontSize: 12 }}>Review-based score, not a guarantee of salary payments or contract reliability.</Text>
  </GlassCard>;
}
