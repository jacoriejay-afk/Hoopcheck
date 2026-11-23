import { Pressable, Text, View } from "react-native";
import { GlassCard } from "./GlassCard";
import { glassTokens as glass } from "../../src/glassTheme";

export function GlassSegmented<T extends string>({ value, options, onChange, disabled = false }: {
  value: T; options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void; disabled?: boolean;
}) {
  return <GlassCard radius={999} padding={4} solid>
    <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 4 }}>
      {options.map(option => <Pressable key={option.value} accessibilityRole="tab"
        accessibilityState={{ selected: value === option.value, disabled }}
        disabled={disabled} onPress={() => onChange(option.value)}
        style={{ flex: 1, minHeight: 44, justifyContent: "center", alignItems: "center",
          borderRadius: 999, backgroundColor: value === option.value ? glass.orange : "transparent",
          opacity: disabled ? .6 : 1 }}>
        <Text style={{ color: value === option.value ? "#FFFFFF" : glass.secondary, fontWeight: "800" }}>{option.label}</Text>
      </Pressable>)}
    </View>
  </GlassCard>;
}
