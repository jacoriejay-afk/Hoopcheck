import { Pressable, Text, View } from "react-native";
import { PressableScale } from "./PressableScale";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEntryTheme } from "../src/theme";

const links = [
  { href: "/teams", title: "Teams", detail: "Research teams before you sign", icon: "basketball-outline", color: "button" },
  { href: "/womens", title: "Women’s teams", detail: "Explore women’s basketball", icon: "people-outline", color: "women" },
  { href: "/coaches", title: "Coaches", detail: "Check coaching reputations", icon: "school-outline", color: "coaches" },
  { href: "/leagues", title: "Leagues", detail: "Compare competitions", icon: "trophy-outline", color: "leagues" },
  { href: "/players", title: "Players", detail: "Discover basketball players", icon: "person-outline", color: "players" },
  { href: "/team-hub/groups", title: "HoopGroups", detail: "Find your club’s fan community", icon: "people-outline", color: "button" },
  { href: "/fan-live", title: "Live Games", detail: "Games, chat and predictions", icon: "radio-outline", color: "button" },
  { href: "/feed", title: "HoopFeed", detail: "Community, comments and Reels", icon: "basketball-outline", color: "button" },
] as const;
export function ExploreLinks({ publicOnly = false, compact = false }: { publicOnly?: boolean; compact?: boolean }) {
  const theme = useEntryTheme(); const router = useRouter();
  // Motion is Home-only: public and full-size directory links remain unchanged.
  const ItemPressable = compact ? PressableScale : Pressable;
  return <View style={compact ? { flexDirection: "row", flexWrap: "wrap", gap: 8 } : { gap: theme.spacing.sm }}>
    {links.filter((_, index) => !publicOnly || index < 5).map(item =>
      <ItemPressable key={item.href} accessibilityRole="link" accessibilityLabel={item.title}
        testID={`directory-${item.title.toLowerCase()}`} onPress={() => router.push(item.href)}
        style={({ pressed }) => ({
          flexDirection: "row", alignItems: "center",
          ...(compact ? { width: "48%" as const, flexGrow: 1, minHeight: 56, paddingHorizontal: 9, paddingVertical: 6, gap: 8 }
            : { minHeight: 70, padding: theme.spacing.md, gap: theme.spacing.md }),
          borderRadius: theme.radius.control, borderCurve: "continuous" as const,
          borderWidth: 1, borderColor: theme.border,
          backgroundColor: pressed ? theme.accentSurface : theme.surface,
        })}>
        <View style={{ width: compact ? 32 : 44, height: compact ? 32 : 44, borderRadius: 11,
          alignItems: "center", justifyContent: "center", backgroundColor: theme.accentSurface }}>
          <Ionicons name={item.icon} size={compact ? 18 : 22} color={theme.accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text numberOfLines={compact ? 2 : undefined} style={{ color: theme.foreground, fontSize: compact ? 12 : undefined,
            fontWeight: compact ? "700" : undefined, ...(!compact ? theme.type.section : {}) }}>{item.title}</Text>
          {!compact ? <Text style={{ color: theme.muted, fontSize: 12, lineHeight: 17 }}>{item.detail}</Text> : null}
        </View>
        {!compact ? <Ionicons name="chevron-forward" size={17} color={theme.foreground} /> : null}
      </ItemPressable>)}
  </View>;
}
