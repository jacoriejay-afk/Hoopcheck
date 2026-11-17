import { BlurView } from "expo-blur";
import { Platform, Pressable, Text, TextInput, View, type PressableProps, type TextInputProps, type ViewProps } from "react-native";
import { useEntryTheme } from "./theme";

export function GlassCard({ style, children, ...props }: ViewProps) {
  const t = useEntryTheme();
  const frame = [{ borderRadius: t.radius.hero, borderWidth: 1, borderColor: t.border, overflow: "hidden" as const, padding: t.spacing.xl, backgroundColor: t.surface }, t.shadow, style];
  return <View {...props} style={frame}>
    {Platform.OS === "ios" && <BlurView pointerEvents="none" intensity={12} tint={t.dark ? "dark" : "light"} style={{ position: "absolute", inset: 0, backgroundColor: t.glassFill }} />}
    {children}
  </View>;
}
export function Button({ children, secondary = false, style, ...props }: PressableProps & { secondary?: boolean }) {
  const t = useEntryTheme();
  return <Pressable accessibilityRole="button" {...props} style={state => [{ minHeight: 52, padding: t.spacing.md, borderRadius: t.radius.control, borderWidth: 1, borderColor: secondary ? t.border : t.button, backgroundColor: secondary ? t.surface : t.button, alignItems: "center", justifyContent: "center", opacity: props.disabled ? .65 : state.pressed ? .75 : 1 }, typeof style === "function" ? style(state) : style]}>
    {typeof children === "string" ? <Text style={{ color: secondary ? t.foreground : t.onButton, fontSize: 16, fontWeight: "800" }}>{children}</Text> : children}
  </Pressable>;
}
export function Input({ style, ...props }: TextInputProps) {
  const t = useEntryTheme();
  return <TextInput placeholderTextColor={t.muted} selectionColor={t.accent} {...props} style={[{ minHeight: 50, paddingHorizontal: t.spacing.md, borderWidth: 1, borderColor: t.border, borderRadius: t.radius.control, color: t.foreground, backgroundColor: t.input, ...t.type.body }, style]} />;
}
export function Chip({ children }: { children: string }) {
  const t = useEntryTheme();
  return <View style={{ backgroundColor: t.chip, borderRadius: t.radius.pill, padding: t.spacing.sm }}><Text style={{ ...t.type.caption, color: t.onChip }}>{children}</Text></View>;
}
export function SectionHeader({ children }: { children: string }) {
  const t = useEntryTheme();
  return <Text accessibilityRole="header" style={{ ...t.type.section, color: t.foreground }}>{children}</Text>;
}
