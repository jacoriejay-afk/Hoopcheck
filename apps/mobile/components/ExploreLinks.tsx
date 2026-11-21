import Svg, { Path } from "react-native-svg";
import { Pressable, Text, View } from "react-native";
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
export function ExploreLinks({ publicOnly = false }: { publicOnly?: boolean }) {
  const theme = useEntryTheme(); const router = useRouter();
  return <View style={{ gap: theme.spacing.sm }}>{links.filter((_, index) => !publicOnly || index < 5).map(item => <Pressable key={item.href} accessibilityRole="link" testID={`directory-${item.title.toLowerCase()}`} onPress={() => router.push(item.href)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", minHeight: 70, padding: theme.spacing.md, gap: theme.spacing.md, borderRadius: theme.radius.control, borderCurve: "continuous", borderWidth: 1, borderColor: theme.border, backgroundColor: pressed ? theme.accentSurface : theme.surface })}>
    <View style={{ width: 42, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "transparent" }}><Svg pointerEvents="none" width={42} height={44} viewBox="0 0 100 100" style={{ position: "absolute" }}><Path d="M25 3H75L99 50 75 97H25L1 50Z" fill={item.color === "button" ? theme.button : theme.roles[item.color]} /></Svg><Ionicons name={item.icon} size={22} color={theme.onButton} /></View>
    <View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text style={{ color: theme.foreground, fontFamily: "HoopCheckDisplay", fontSize: 17 }}>{item.title}</Text><Text style={{ color: theme.muted, fontSize: 12, lineHeight: 17 }}>{item.detail}</Text></View>
    <Ionicons name="arrow-forward" size={17} color={theme.foreground} />
  </Pressable>)}</View>;
}
