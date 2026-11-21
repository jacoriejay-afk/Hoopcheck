import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PressableCard, SectionHeader, Button } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { Skeleton } from "./Motion";

/** Uses the verified account provider; metadata never grants feature access. */
export function HomeCourtside() {
  const theme = useEntryTheme();
  const router = useRouter();
  const { account, loading, error, retry } = useNativeAccount();
  if (loading) return <Skeleton review />;
  if (!account) return <View style={{ gap: theme.spacing.sm }}><Text accessibilityRole="alert" style={{ color: theme.muted }}>{error || "Verify your account to personalize Home."}</Text><Button secondary onPress={retry}>Retry account verification</Button></View>;
  const fan = account.user.accountType === "fan";
  const destinations = [
    { route: "/fan-live", title: "Game Center", detail: "Live scores, chat and predictions", icon: "radio-outline" },
    { route: "/team-hub/groups", title: "HoopGroups", detail: "Find your club’s community", icon: "people-outline" },
    { route: "/reels", title: "Highlight Hub", detail: "Watch the latest community Reels", icon: "play-circle-outline" },
  ] as const;
  return <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.xl }}>
    <SectionHeader>{account.user.displayName ? `Welcome, ${account.user.displayName}` : "Welcome to courtside"}</SectionHeader>
    <Text style={{ color: theme.muted, ...theme.type.body }}>{fan ? "Follow the game. Find your people." : "Build your connections on and off the court."}</Text>
    {destinations.map(item => <PressableCard key={item.route} accessibilityRole="link" onPress={() => router.push(item.route)}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <Ionicons name={item.icon} size={theme.courtside.navigation.iconSize} color={theme.accent} />
        <View style={{ flex: 1, gap: theme.spacing.xs }}><Text style={{ color: theme.foreground, ...theme.type.section }}>{item.title}</Text><Text style={{ color: theme.muted, ...theme.type.caption }}>{item.detail}</Text></View>
        <Ionicons name="chevron-forward" size={18} color={theme.muted} />
      </View>
    </PressableCard>)}
  </View>;
}
