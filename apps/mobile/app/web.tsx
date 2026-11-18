import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { canonicalWebUrl } from "../src/native/deepLinks";
import { useEntryTheme } from "../src/theme";

export default function WebHandoff() {
  const { path } = useLocalSearchParams<{ path?: string }>();
  const url = canonicalWebUrl(typeof path === "string" ? path : "/");
  const isReferral = typeof path === "string" && path.startsWith("/referral/");
  const theme = useEntryTheme();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function open() {
    if (!url || busy) return;
    setBusy(true);
    try { await WebBrowser.openBrowserAsync(url); }
    catch { setError("Couldn’t open HoopCheck. Check your connection and try again."); }
    finally { setBusy(false); }
  }
  return <View style={{ flex: 1, padding: 24, gap: 20, justifyContent: "center", backgroundColor: theme.background }}>
    <Text accessibilityRole="header" style={{ color: theme.foreground, fontSize: 28, fontWeight: "900" }}>Continue on HoopCheck</Text>
    <Text style={{ color: theme.muted }}>{isReferral ? "Complete signup in the browser to keep your referral attached." : "Open this page on the HoopCheck website."}</Text>
    <Pressable accessibilityRole="link" disabled={!url || busy} onPress={() => void open()} style={{ minHeight: 48 }}><Text style={{ color: theme.accent, fontSize: 18 }}>Open page</Text></Pressable>
    {error ? <Text accessibilityRole="alert" style={{ color: theme.foreground }}>{error}</Text> : null}
  </View>;
}
