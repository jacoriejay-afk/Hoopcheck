import { Text, View } from "react-native";
import { useEntryTheme } from "../src/theme";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { Button, SectionHeader } from "../src/primitives";
import { Skeleton } from "./Motion";
/** Current server-verified permissions only. This preview never grants access or changes a plan. */
export function MembershipPreview() {
  const t = useEntryTheme(); const { account, loading, error, retry } = useNativeAccount();
  if (loading) return <Skeleton review />;
  if (!account) return <View style={{ gap: t.spacing.sm }}><Text accessibilityRole="alert" style={{ color: t.muted }}>{error || "Verify your account to preview your access."}</Text><Button secondary onPress={retry}>Retry access preview</Button></View>;
  const rights = [
    ["Read HoopFeed", account.features.canReadHoopFeed], ["Post & react", account.features.canWriteHoopFeed],
    ["Game Center", account.features.canUseLiveGameHub], ["Live chat", account.features.canUseLiveGameChat],
    ["Switch basketball side", account.features.canSwitchBasketballSide], ["Join club groups", account.features.canUseFanGroups],
  ] as const;
  return <View style={{ gap: t.spacing.md }}><SectionHeader>Your membership access</SectionHeader><Text style={{ color: t.muted, ...t.type.caption }}>Current {account.tier} access for your {account.user.accountType.replaceAll("_", " ")} account. Individual screens also check role, moderation and game-room rules.</Text>
    {rights.map(([label, included]) => <View key={label} style={{ flexDirection: "row", gap: t.spacing.md, alignItems: "center", paddingVertical: t.spacing.sm, borderBottomWidth: 1, borderBottomColor: t.border }}><Text style={{ flex: 1, color: t.foreground, ...t.type.body }}>{label}</Text><Text style={{ color: included ? t.success : t.muted, ...t.type.caption }}>{included ? "Included" : "Not included"}</Text></View>)}
  </View>;
}
