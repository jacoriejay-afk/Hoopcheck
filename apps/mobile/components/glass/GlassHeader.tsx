import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandLogo } from "../BrandLogo";
import { GlassCard } from "./GlassCard";
import { glassTokens as glass } from "../../src/glassTheme";

/** Inset is applied exactly once; never render inside a top SafeAreaView. */
export function GlassHeader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return <View testID="glass-safe-header" style={{
    paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8, zIndex: 3,
  }}>
    <GlassCard radius={999} padding={8}>
      <View style={{ height: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 9 }}>
        <BrandLogo />
        <Pressable accessibilityRole="button" accessibilityLabel="Alerts"
          onPress={() => router.push("/notifications")}
          style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="notifications-outline" size={23} color={glass.foreground} />
          <View pointerEvents="none" accessible={false} style={{ position: "absolute", right: 9, top: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: glass.orange }} />
        </Pressable>
      </View>
    </GlassCard>
  </View>;
}
