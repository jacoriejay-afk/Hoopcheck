import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { GlassSurface } from "./GlassSurface";
import { useEntryTheme } from "../src/theme";

/** A single compact, accessible navigation strip. No previous-page label. */
export function NativePageHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const theme = useEntryTheme();
  const insets = useSafeAreaInsets();
  return <View testID="native-page-header" style={{ paddingTop: insets.top + 3, paddingBottom: 4,
    paddingLeft: Math.max(10, insets.left), paddingRight: Math.max(10, insets.right), backgroundColor: "transparent" }}>
    <GlassSurface navigation intensity={55} style={{ minHeight: 46, borderRadius: 26, borderWidth: 0,
      flexDirection: "row", alignItems: "center", paddingHorizontal: 5 }}>
      <View style={{ width: 44 }}>{onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Back"
        onPress={onBack} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="chevron-back" size={24} color={theme.accent} />
      </Pressable> : null}</View>
      <Text accessibilityRole="header" accessibilityLabel={title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}
        style={{ flex: 1, textAlign: "center", color: theme.foreground, fontFamily: "HoopCheckDisplay",
          fontSize: 21, lineHeight: 28 }}>{title.toUpperCase()}</Text>
      <View style={{ width: 44 }} />
    </GlassSurface>
  </View>;
}
