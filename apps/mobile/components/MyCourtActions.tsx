import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Reveal } from "./Motion";
import { useEntryTheme } from "../src/theme";
import {
  courtChoices, defaultCourtActions, normalizeCourtActions, toggleCourtAction,
  type CourtActionId, type CourtFeatures,
} from "../src/native/myCourtActions";

const colors = {
  orange: { dark: "#FFAD76", light: "#B94E17" },
  blue: { dark: "#87C7FF", light: "#1768A2" },
  green: { dark: "#84DCB8", light: "#1B7950" },
  violet: { dark: "#CEB0FF", light: "#7146B6" },
};

/**
 * On-device personalization only. Preferences are stored under the verified
 * account ID; destination screens retain all server-side role/tier checks.
 */
export function MyCourtActions({ userId, role, feedEnabled }: {
  userId: string; role: string; feedEnabled: boolean;
}) {
  const theme = useEntryTheme();
  const router = useRouter();
  const features: CourtFeatures = {
    feed: feedEnabled,
    hoopgroups: process.env.EXPO_PUBLIC_HOOPGROUPS_CHANNELS_ENABLED === "true",
  };
  const storageKey = `hoopcheck:my-court:v1:${userId}`;
  const [selected, setSelected] = useState<CourtActionId[]>(() => defaultCourtActions(role, features));
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const writeQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    setSelected(defaultCourtActions(role, features));
    setReady(false);
    setEditing(false);
    setError("");
    void AsyncStorage.getItem(storageKey).then(raw => {
      let saved: unknown = null;
      if (raw) {
        try { saved = JSON.parse(raw) as unknown; } catch { saved = null; }
      }
      if (active) setSelected(normalizeCourtActions(saved, role, features));
    }).catch(() => {
      if (active) setError("Custom shortcuts could not be loaded on this device.");
    }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [storageKey, role, feedEnabled, features.hoopgroups]);

  function update(next: CourtActionId[]) {
    if (!ready) return;
    setSelected(next);
    setError("");
    // Serialize local writes so quick repeated selections cannot restore stale order.
    writeQueue.current = writeQueue.current.catch(() => {}).then(async () => {
      await AsyncStorage.setItem(storageKey, JSON.stringify(next));
    }).catch(() => {
      setError("Could not save shortcuts on this device. Please try again.");
    });
  }

  const choices = courtChoices(role, features);
  const cards = selected.flatMap(id => choices.filter(action => action.id === id));

  return <View style={{ gap: 8 }}>
    <View style={{ flexDirection: "row", alignItems: "center", minHeight: 44, gap: 9 }}>
      <View style={{ width: 4, height: 23, borderRadius: 3, backgroundColor: theme.accent }} />
      <Text accessibilityRole="header" style={{
        flex: 1, minWidth: 0, fontFamily: "HoopCheckDisplay", fontSize: 21,
        lineHeight: 25, color: theme.foreground,
      }}>MY COURT</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={editing ? "Finish customizing My Court" : "Customize My Court"}
        accessibilityState={{ disabled: !ready }}
        disabled={!ready} onPress={() => setEditing(value => !value)}
        style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 9, justifyContent: "center",
          borderRadius: 12, opacity: pressed ? .72 : ready ? 1 : .5, flexDirection: "row", alignItems: "center", gap: 5 })}>
        <Ionicons name={editing ? "checkmark" : "options-outline"} size={18} color={theme.accent} />
        <Text style={{ color: theme.accent, fontSize: 12, fontWeight: "800" }}>{editing ? "Done" : "Customize"}</Text>
      </Pressable>
    </View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
      {cards.map((action, index) => {
        const accent = colors[action.tone][theme.dark ? "dark" : "light"];
        return <View key={action.id} style={{ width: "48%", flexGrow: 1 }}>
          <Pressable accessibilityRole="link" accessibilityLabel={action.label} onPress={() => router.push(action.href)}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", minHeight: 58,
              paddingHorizontal: 9, paddingVertical: 7, gap: 8, borderRadius: 14,
              borderWidth: 1, borderColor: theme.dark ? theme.glassBorder : theme.border,
              backgroundColor: theme.elevatedSurface, opacity: pressed ? .76 : 1,
              transform: [{ scale: pressed ? .98 : 1 }] })}>
            <View style={{ width: 33, height: 33, borderRadius: 11, backgroundColor: theme.accentSurface,
              alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={action.icon} size={19} color={accent} />
            </View>
            <Text numberOfLines={2} style={{ flex: 1, color: theme.foreground, fontSize: 12,
              lineHeight: 16, fontFamily: theme.type.ui.fontFamily, fontWeight: "700" }}>{action.label}</Text>
            <Ionicons name="chevron-forward" size={13} color={theme.muted} />
          </Pressable>
        </View>;
      })}
    </View>
    {editing ? <Reveal><View style={{ gap: 8, paddingTop: 4 }}>
      <Text style={{ color: theme.muted, fontSize: 12 }}>
        Pick up to four shortcuts. Only this device is customized; features still follow your membership.
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
        {choices.map(action => {
          const active = selected.includes(action.id);
          const disabled = !active && selected.length >= 4;
          return <Pressable key={action.id} accessibilityRole="checkbox"
            accessibilityLabel={action.label} accessibilityState={{ checked: active, disabled }}
            disabled={disabled} onPress={() => update(toggleCourtAction(selected, action.id, role, features))}
            style={({ pressed }) => ({ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6,
              paddingHorizontal: 11, borderRadius: 12, borderWidth: 1,
              borderColor: active ? theme.accent : theme.border,
              backgroundColor: active ? theme.accentSurface : theme.surface,
              opacity: disabled ? .42 : pressed ? .72 : 1 })}>
            <Ionicons name={active ? "checkmark-circle" : "add-circle-outline"} size={16}
              color={active ? theme.accent : theme.muted} />
            <Text style={{ color: theme.foreground, fontSize: 12, fontWeight: active ? "800" : "600" }}>{action.label}</Text>
          </Pressable>;
        })}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Reset My Court shortcuts"
        onPress={() => update(defaultCourtActions(role, features))}
        style={{ minHeight: 44, alignSelf: "flex-start", justifyContent: "center", paddingHorizontal: 8 }}>
        <Text style={{ color: theme.accent, fontSize: 12, fontWeight: "700" }}>Reset to my role defaults</Text>
      </Pressable>
    </View></Reveal> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: theme.error, fontSize: 12 }}>{error}</Text> : null}
  </View>;
}
