import { Stack, useRouter } from "expo-router";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../src/primitives";
import { useEntryTheme } from "../src/theme";

export default function NotFound() {
  const router = useRouter();
  const theme = useEntryTheme();
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
    <Stack.Screen options={{ title: "Page unavailable" }} />
    <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 16 }}>
      <Text accessibilityRole="header" style={{ color: theme.foreground, fontSize: 26, fontWeight: "900" }}>This page is unavailable</Text>
      <Text style={{ color: theme.muted, fontSize: 16 }}>This link may belong to an older or newer version of HoopCheck. Return to the app to find the page again.</Text>
      <Button onPress={() => router.replace("/")}>Return to HoopCheck</Button>
      {router.canGoBack() ? <Button secondary onPress={() => router.back()}>Go back</Button> : null}
    </View>
  </SafeAreaView>;
}
