import { Children, type ReactNode } from "react";
import { Pressable, Text, TextInput, View, type PressableProps, type TextInputProps, type ViewProps } from "react-native";
import { useEntryTheme } from "./theme";

export function GlassCard({ style, children, ...props }: ViewProps) {
  const t = useEntryTheme();
  const frame = [{ borderRadius: t.courtside.card.radius, borderCurve: "continuous" as const, borderWidth: 1, borderColor: t.border, overflow: "hidden" as const, padding: t.spacing.lg, backgroundColor: t.surface, shadowColor: "#000", shadowOpacity: t.dark ? .18 : .055, shadowRadius: 15, shadowOffset: { width: 0, height: 7 } }, style];
  return <View {...props} style={frame}>
    {children}
  </View>;
}
export function Button({ children, secondary = false, style, ...props }: PressableProps & { secondary?: boolean }) {
  const t = useEntryTheme();
  const labelStyle = { color: secondary ? t.foreground : t.onButton, fontSize: 16, fontWeight: "800" as const };
  const content = (value: ReactNode) => {
    const parts = Children.toArray(value);
    // JSX such as "Rotate photo {index + 1}" produces an array, even when
    // the entire label is text. Native Pressable cannot contain raw strings.
    if (parts.every(part => typeof part === "string" || typeof part === "number")) return <Text style={labelStyle}>{value}</Text>;
    return parts.map((part, index) => typeof part === "string" || typeof part === "number" ? <Text key={index} style={labelStyle}>{part}</Text> : part);
  };
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: Boolean(props.disabled) }} {...props} style={state => [{ minHeight: 52, padding: t.spacing.md, borderRadius: 17, borderCurve: "continuous", borderWidth: 1, borderColor: secondary ? t.glassBorder : t.button, backgroundColor: secondary ? t.elevatedSurface : t.button, alignItems: "center", justifyContent: "center", opacity: props.disabled ? .65 : state.pressed ? .75 : 1 }, typeof style === "function" ? style(state) : style]}>
    {state => content(typeof children === "function" ? children(state) : children)}
  </Pressable>;
}
export function Input({ style, ...props }: TextInputProps) {
  const t = useEntryTheme();
  return <TextInput keyboardAppearance={t.dark ? "dark" : "light"} placeholderTextColor={t.muted} selectionColor={t.accent} {...props} style={[{ minHeight: 50, paddingHorizontal: t.spacing.md, borderWidth: 1, borderColor: t.border, borderRadius: 17, color: t.foreground, backgroundColor: t.input, ...t.type.body }, style]} />;
}
export function Chip({ children }: { children: string }) {
  const t = useEntryTheme();
  return <View style={{ backgroundColor: t.chip, borderRadius: t.radius.pill, padding: t.spacing.sm }}><Text style={{ ...t.type.caption, color: t.onChip }}>{children}</Text></View>;
}
export function SectionHeader({ children }: { children: string }) {
  const t = useEntryTheme();
  return <Text accessibilityRole="header" style={{ fontFamily: "HoopCheckDisplay", fontSize: 23, lineHeight: 27, borderLeftWidth: 3, borderLeftColor: t.button, paddingLeft: 10, color: t.foreground }}>{children}</Text>;
}

/** A full-row target with the same tactile feedback in every discovery list. */
export function PressableCard({ children, style, ...props }: PressableProps) {
  const t = useEntryTheme();
  return <Pressable accessibilityRole="button" {...props} style={state => [{ minHeight: 44, opacity: state.pressed ? .72 : 1 }, typeof style === "function" ? style(state) : style]}>
    {state => <GlassCard style={{ padding: t.spacing.lg, gap: t.spacing.sm }}>{typeof children === "function" ? children(state) : children}</GlassCard>}
  </Pressable>;
}
