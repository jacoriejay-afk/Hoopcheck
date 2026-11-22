import { useFocusEffect } from "expo-router";
import { readWithDeadline } from "../src/native/readDeadline";
import { sharePlayerPassport } from "../src/native/passportSharing";
import { requestNativeAccount } from "../src/native/accountClient";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, Text, View } from "react-native";
import { BrandLogo } from "./BrandLogo";
import { Sheet } from "./Sheet";
import { Button } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { useHaptics } from "../src/native/haptics";
import { supabase } from "../src/lib/supabase";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { passportFields } from "../src/native/playerPassport";
import type { PlayerProfile } from "../src/native/playerProfiles";

export function PlayerPassport({ player }: { player: PlayerProfile }) {
  const t = useEntryTheme(); const haptic = useHaptics();
  const { account } = useNativeAccount();
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const locked = useRef(false);
  const owner = account?.user.accountType === "player" && account.user.id === player.id ? account.user.id : null;
  const generation = useRef(0);
  const mounted = useRef(true);
  const focused = useRef(false);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => { focused.current = false; generation.current++; setOpen(false); };
  }, []));
  useEffect(() => {
    mounted.current = true; generation.current++; setOpen(false); setError("");
    const listener = AppState.addEventListener("change", state => { if (state !== "active") generation.current++; });
    return () => { mounted.current = false; listener.remove(); };
  }, [owner]);
  if (!owner) return null;
  const pass = passportFields(player, owner);
  async function share() {
    if (locked.current || !owner) return;
    locked.current = true; setBusy(true); setError("");
    const current = generation.current;
    try {
      // Lazy imports retain a recoverable path on installed clients without these modules.
      let modules: Promise<[typeof import("expo-print"), typeof import("expo-sharing"), typeof import("expo-file-system")]> | undefined;
      const native = () => modules ??= Promise.all([import("expo-print"), import("expo-sharing"), import("expo-file-system")]);
      await sharePlayerPassport(pass, owner, {
        platform: Platform.OS,
        current: () => focused.current && mounted.current && generation.current === current && AppState.currentState === "active",
        identity: async () => {
          const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000);
          try {
            const session = await readWithDeadline(() => supabase.auth.getSession());
            if (session.error || session.data.session?.user.id !== owner) return null;
            const verified = await requestNativeAccount(process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim() || "https://hoopcheck.online", session.data.session.access_token, controller.signal);
            return verified.user;
          } finally { clearTimeout(timer); }
        },
        available: async () => (await native())[1].isAvailableAsync(),
        print: async html => (await (await native())[0].printToFileAsync({ html, width: 612, height: 792 })).uri,
        share: async uri => (await native())[1].shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "Share your Player Passport" }),
        remove: async uri => { const { File } = (await native())[2]; new File(uri).delete(); },
      });
      if (mounted.current && generation.current === current) haptic("posted");
    } catch (failure) {
      if (mounted.current && generation.current === current) { setError(failure instanceof Error ? failure.message : "Could not export your Passport. Try again."); haptic("error"); }
    } finally { locked.current = false; if (mounted.current) setBusy(false); }
  }

  return <>
    <Button secondary onPress={() => { setError(""); setOpen(true); }}>Preview Player Passport</Button>
    <Sheet dismissible={!busy} open={open} onClose={() => { if (!busy) setOpen(false); }} title="Your Player Passport">
      {open ? <View style={{
        backgroundColor: t.entityHero.background, borderRadius: 18, borderCurve: "continuous",
        padding: 16, gap: 12, borderWidth: 1, borderColor: t.glassBorder, borderTopWidth: 3, borderTopColor: t.button,
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <BrandLogo onHero />
          <Text style={{ color: t.entityHero.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1 }}>PLAYER PASSPORT</Text>
        </View>
        <Text accessibilityRole="header" style={{ color: t.entityHero.ink, fontSize: 24, fontWeight: "800" }}>{pass.name}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View accessible={false} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: t.button }} />
          <Text style={{ color: t.entityHero.ink, fontSize: 12, fontWeight: "700" }}>
            {pass.verified ? "HoopCheck verified player" : "HoopCheck player profile"}
          </Text>
        </View>
        <View style={{ height: 1, backgroundColor: t.glassBorder }} />
        {([
          ["Position", pass.position || "Not listed"],
          ["Current team", pass.team || "Not listed"],
          ["Pro experience", pass.years === null ? "Not listed" : `${pass.years} ${pass.years === 1 ? "year" : "years"} · profile reported`],
        ] as const).map(([label, value]) => <View key={label} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <Text style={{ color: t.entityHero.muted, width: 104, fontSize: 12 }}>{label}</Text>
          <Text style={{ color: t.entityHero.ink, flex: 1, minWidth: 0, fontSize: 13, fontWeight: "700" }}>{value}</Text>
        </View>)}
      </View> : null}
      <Text style={{ color: t.muted, ...t.type.caption }}>Sharing exports the name, position, team, experience and verification shown above as a PDF. It excludes your location, contact information and private career stops. Share only with people you choose.</Text>
      <Button disabled={busy} accessibilityState={{ busy, disabled: busy }} onPress={() => void share()}>{busy ? "Preparing Passport…" : "Export & share PDF"}</Button>
      {error ? <Text accessibilityRole="alert" style={{ color: t.muted }}>{error}</Text> : null}
    </Sheet>
  </>;
}
