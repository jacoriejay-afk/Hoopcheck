/** CI-only standalone entry. Never imported by Expo Router or the production main. */
import { registerRootComponent } from "expo";
import { useRef, useState } from "react";
import { AppState, Pressable, Text, useColorScheme } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { File } from "expo-file-system";
import { sharePlayerPassport } from "../../src/native/passportSharing";
const owner = "11111111-1111-4111-8111-111111111111";
function PassportSmoke() {
  const dark = useColorScheme() === "dark";
  const [status, setStatus] = useState("IDLE");
  const [detail, setDetail] = useState("No backend, account or production data is used.");
  const startShare = useRef<null | (() => Promise<void>)>(null);
  const locked = useRef(false);
  const text = { color: dark ? "#F7F7F5" : "#171717", fontSize: 18 };
  async function prepare() {
    if (locked.current) return;
    locked.current = true; setStatus("PREPARING");
    try {
      await sharePlayerPassport({ name: "CI Synthetic Player", team: "CI Test Club", position: "PG", years: 3, verified: false }, owner, {
        // CI-only cold-simulator allowance. Production keeps its 30s guard.
        platform: "ios", timeoutMs: 90000, identity: async () => ({ id: owner, accountType: "player" }), current: () => AppState.currentState === "active",
        available: () => Sharing.isAvailableAsync(),
        print: async html => {
          const started = Date.now();
          try {
            const result = await Print.printToFileAsync({ html, width: 612, height: 792 });
            const file = new File(result.uri); const bytes = await file.bytes();
            if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-" || result.numberOfPages < 1 || file.size < 200) throw Error("Invalid native PDF");
            setDetail(`Native PDF: ${result.numberOfPages} page(s), ${file.size} bytes, valid PDF signature`);
            return result.uri;
          } catch (error) {
            // Synthetic CI fixture only: capture the cause instead of a generic timeout.
            const reason = error instanceof Error ? error.message : "Unknown print failure";
            console.warn("PASSPORT_SMOKE_PRINT_FAILURE", reason.slice(0, 240));
            throw error;
          } finally {
            console.log("PASSPORT_SMOKE_PRINT_ELAPSED_MS", Date.now() - started);
          }
        },
        share: uri => new Promise<void>((resolve, reject) => {
          startShare.current = async () => {
            setStatus("SHARE_REQUESTED");
            try { await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "CI Synthetic Passport" }); resolve(); }
            catch (error) { reject(error); }
          };
          setStatus("PDF_READY");
        }),
        remove: async uri => { const file = new File(uri); file.delete(); if (file.exists) throw Error("Native PDF cleanup failed"); },
      });
      setStatus("CLEANED");
    } catch (error) { setStatus("FAILED"); setDetail(error instanceof Error ? error.message : "Native smoke failed"); }
    finally { locked.current = false; }
  }
  const button = { minHeight: 52, padding: 16, borderRadius: 12, backgroundColor: "#FF5A1F", marginTop: 20 };
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, padding: 24, backgroundColor: dark ? "#171717" : "#F4F4F1", justifyContent: "center", gap: 16 }}>
    <Text style={text}>CI SIMULATOR · SYNTHETIC PASSPORT</Text>
    <Text testID="passport-smoke-status" accessibilityLabel={status} style={text}>{status}</Text>
    <Text testID="passport-smoke-detail" style={text}>{detail}</Text>
    <Pressable testID="passport-smoke-prepare" accessibilityRole="button" disabled={status !== "IDLE"} onPress={() => void prepare()} style={button}><Text>Prepare native Passport PDF</Text></Pressable>
    {status === "PDF_READY" ? <Pressable testID="passport-smoke-share" accessibilityRole="button" onPress={() => void startShare.current?.()} style={button}><Text>Present native share sheet</Text></Pressable> : null}
  </SafeAreaView></SafeAreaProvider>;
}
registerRootComponent(PassportSmoke);
