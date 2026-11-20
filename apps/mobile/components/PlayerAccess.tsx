import { Fragment, type ReactNode } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { canBrowsePlayers, type PlayerViewer } from "../src/native/playerProfiles";
export function PlayerAccess({ children }: { children: (viewer: PlayerViewer) => ReactNode }) {
  const theme = useEntryTheme(); const { account, loading, error, retry } = useNativeAccount();
  if (account && canBrowsePlayers(account.user.accountType)) return <Fragment key={`${account.user.id}:${account.user.accountType}`}>{children({ id: account.user.id, accountType: account.user.accountType })}</Fragment>;
  return <SafeAreaView edges={["left", "right", "bottom"]} style={{ flex: 1, backgroundColor: theme.background }}><View style={{ padding: 24, gap: 14 }}><Text accessibilityRole="header" style={{ fontSize: 24, color: theme.foreground, fontWeight: "800" }}>Player profiles</Text><Text style={{ color: theme.muted }}>{loading ? "Verifying profile access…" : account ? (account.user.accountType === "fan" ? "Player profiles are unavailable for fan accounts." : "Player profiles are unavailable for this account.") : error || "Sign in again to verify your account."}</Text>{!account && !loading ? <Button secondary onPress={retry}>Retry profile access</Button> : null}</View></SafeAreaView>;
}
