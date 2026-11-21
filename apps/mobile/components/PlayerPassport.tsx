import { useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import { BrandLogo } from "./BrandLogo";
import { Sheet } from "./Sheet";
import { Button } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { useHaptics } from "../src/native/haptics";
import { supabase } from "../src/lib/supabase";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { passportFields, passportHtml } from "../src/native/playerPassport";
import type { PlayerProfile } from "../src/native/playerProfiles";

export function PlayerPassport({ player }: { player: PlayerProfile }) {
  const t = useEntryTheme(); const haptic = useHaptics();
  const { account } = useNativeAccount();
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const locked = useRef(false);
  const owner = account?.user.accountType === "player" && account.user.id === player.id ? account.user.id : null;
  if (!owner) return null;
  const pass = passportFields(player, owner);
  async function share() {
    if (locked.current || !owner) return;
    locked.current = true; setBusy(true); setError("");
    let temporary: { delete: () => void } | undefined;
    try {
      if (Platform.OS === "web") throw Error("Passport file sharing is available in the iOS and Android app.");
      const session = await supabase.auth.getSession();
      if (session.error || session.data.session?.user.id !== owner) throw Error("Verify your account again before exporting.");
      const [Print, Sharing, { File }] = await Promise.all([import("expo-print"), import("expo-sharing"), import("expo-file-system")]);
      if (!await Sharing.isAvailableAsync()) throw Error("File sharing is unavailable on this device.");
      const result = await Print.printToFileAsync({ html: passportHtml(pass), width: 612, height: 792 });
      temporary = new File(result.uri);
      const after = await supabase.auth.getSession();
      if (after.error || after.data.session?.user.id !== owner) throw Error("Your session changed. Export cancelled.");
      await Sharing.shareAsync(result.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "Share your Player Passport" });
      haptic("posted");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not export your Passport. Try again."); haptic("error"); }
    finally { try { temporary?.delete(); } catch { /* Cache can also be purged by the OS. */ } locked.current = false; setBusy(false); }
  }
  return <>
    <Button secondary onPress={() => { setError(""); setOpen(true); }}>Preview Player Passport</Button>
    <Sheet open={open} onClose={() => { if (!busy) setOpen(false); }} title="Your Player Passport">
      <View style={{ backgroundColor: t.entityHero.background, borderRadius: t.radius.hero, borderCurve: "continuous", padding: t.spacing.xl, gap: t.spacing.lg, borderTopWidth: 4, borderTopColor: t.button }}>
        <BrandLogo onHero />
        <Text style={{ color: t.entityHero.muted, ...t.type.caption }}>PLAYER PASSPORT</Text>
        <Text style={{ color: t.entityHero.ink, ...t.type.title }}>{pass.name}</Text>
        <Text style={{ color: t.entityHero.muted, ...t.type.body }}>{[pass.position, pass.team].filter(Boolean).join(" · ") || "Player profile"}</Text>
        {pass.years !== null ? <Text style={{ color: t.entityHero.muted }}>{pass.years} years pro · profile reported</Text> : null}
        <Text style={{ color: t.entityHero.ink }}>{pass.verified ? "Verified professional player" : "HoopCheck player"}</Text>
      </View>
      <Text style={{ color: t.muted, ...t.type.caption }}>Sharing exports the name, position, team, experience and verification shown above as a PDF. It excludes your location, contact information and private career stops. Share only with people you choose.</Text>
      <Button disabled={busy} accessibilityState={{ busy, disabled: busy }} onPress={() => void share()}>{busy ? "Preparing Passport…" : "Export & share PDF"}</Button>
      {error ? <Text accessibilityRole="alert" style={{ color: t.muted }}>{error}</Text> : null}
    </Sheet>
  </>;
}
