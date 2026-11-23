import { Text, View } from "react-native";
import { glassTokens as glass } from "../../src/glassTheme";

/** No timestamp means no verified fresh score: fail closed to neutral. */
export function isFreshLive(status: string, scoreUpdatedAt: string | null | undefined, now = Date.now()) {
  if (status !== "live" || !scoreUpdatedAt) return false;
  const updated = Date.parse(scoreUpdatedAt);
  return Number.isFinite(updated) && updated <= now && now - updated < 5 * 60 * 1000;
}
export function GlassBadge({ label, live = false }: { label: string; live?: boolean }) {
  return <View style={{ alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: live ? 0 : 1, borderColor: glass.border,
    backgroundColor: live ? glass.orange : glass.solid }}>
    <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "800", letterSpacing: .3 }}>{label}</Text>
  </View>;
}
