import { useFonts } from "expo-font";
import { useEffect, useState } from "react";
import { Stack, usePathname, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { supabase } from "../src/lib/supabase";
import { useEntryTheme } from "../src/theme";

export default function RootLayout() {
  // Metro statically resolves bundled font assets from require().
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const [fontsLoaded, fontError] = useFonts({ HoopCheckDisplay: require("../assets/hoopcheck-display.ttf") });
  const router = useRouter();
  const segments = useSegments();
  const theme = useEntryTheme();
  const pathname = usePathname();
  const entryScreen = pathname === "/" || pathname === "/dashboard";
  const [sessionReady, setSessionReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSignedIn(Boolean(data.session));
      setSessionReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setSignedIn(Boolean(session));
      setSessionReady(true);
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    const currentRoute = segments[0] ?? "";
    const inAppArea = ["dashboard", "teams", "leagues", "players", "coaches", "choose-username"].includes(currentRoute);
    const onPasswordRecovery = currentRoute === "reset-password";
    // Let the OAuth callback exchange its PKCE code and choose the destination.
    const onAuthCallback = currentRoute === "auth";
    if (signedIn && !inAppArea && !onPasswordRecovery && !onAuthCallback) router.replace("/dashboard");
    if (!signedIn && inAppArea) router.replace("/sign-in");
  }, [sessionReady, signedIn, segments, router]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style={!theme.dark ? "dark" : "light"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.accent,
          headerTitleStyle: { fontWeight: "900", fontSize: 19, color: theme.foreground },
          contentStyle: { backgroundColor: theme.surface },
        }}
      >
        <Stack.Screen name="index" options={{ title: "HoopCheck™", headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ title: "Sign in" }} />
        <Stack.Screen name="auth/callback" options={{ title: "Signing in" }} />
        <Stack.Screen name="sign-up" options={{ title: "Create account" }} />
        <Stack.Screen name="choose-username" options={{ title: "Choose username" }} />
        <Stack.Screen name="forgot-password" options={{ title: "Reset password" }} />
        <Stack.Screen name="reset-password" options={{ title: "Choose new password" }} />
        <Stack.Screen name="dashboard" options={{
          title: "HoopCheck™",
          headerStyle: { backgroundColor: theme.background },
          headerTitleStyle: { fontWeight: "800", color: theme.foreground },
          headerTintColor: theme.accent,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.background },
        }} />
        <Stack.Screen name="players" options={{ title: "Find players" }} />
        <Stack.Screen name="players/[id]" options={{ title: "Player profile" }} />
        <Stack.Screen name="coaches" options={{ title: "Find a coach" }} />
        <Stack.Screen name="teams" options={{ title: "Teams" }} />
        <Stack.Screen name="teams/[id]" options={{ title: "Team profile" }} />
        <Stack.Screen name="teams/[id]/review" options={{ title: "Write a review" }} />
        <Stack.Screen name="leagues" options={{ title: "Leagues" }} />
        <Stack.Screen name="leagues/[id]" options={{ title: "League profile" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
