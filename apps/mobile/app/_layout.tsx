import { useFonts } from "expo-font";
import { rememberDestination, takeDestination } from "../src/native/pendingDestination";
import "react-native-gesture-handler";
import { AccessibilityInfo } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import * as SplashScreen from "expo-splash-screen";
import { DevicePreferences } from "../src/native/preferences";
import { NetworkProvider } from "../src/native/network";
import { MotionProvider } from "../src/motion/Provider";
import { Onboarding } from "../components/Onboarding";
import { AppLock } from "../components/AppLock";
import { TabBar } from "../components/TabBar";
import { RouteFade } from "../components/RouteFade";
import { motion } from "../src/motion/config";
import { traceFlow, Sentry } from "../src/native/telemetry";

void SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: motion.logo, fade: true });
void AccessibilityInfo.isReduceMotionEnabled().then(reduced => SplashScreen.setOptions({ duration: reduced ? motion.shortFade : motion.logo, fade: true })).catch(() => {});
const splashDeadline = setTimeout(() => { void SplashScreen.hideAsync().catch(() => {}); }, motion.splashDeadline - motion.logo);
import { useEffect, useState } from "react";
import { Stack, usePathname, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { supabase } from "../src/lib/supabase";
import { useEntryTheme } from "../src/theme";

function RootLayout() {
  // Metro statically resolves the upstream display font.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const [fontsLoaded, fontError] = useFonts({ HoopCheckDisplay: require("../assets/hoopcheck-display.ttf") });
  const router = useRouter();
  const segments = useSegments();
  const theme = useEntryTheme();
  const [sessionReady, setSessionReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let alive = true;
    traceFlow("startup", () => supabase.auth.getSession()).then(({ data }) => {
      if (!alive) return;
      setSignedIn(Boolean(data.session));
      setSessionReady(true);
    }).catch(() => { if (alive) setSessionReady(true); });
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
    if (sessionReady && (fontsLoaded || fontError)) {
      clearTimeout(splashDeadline);
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [sessionReady, fontsLoaded, fontError]);

  useEffect(() => {
    if (!sessionReady) return;
    const currentRoute = segments[0] ?? "";
    const inAppArea = ["dashboard", "teams", "leagues", "players", "coaches", "choose-username", "settings"].includes(currentRoute);
    if (["web", "sign-in", "sign-up"].includes(currentRoute)) return;
    const onPasswordRecovery = currentRoute === "reset-password";
    // Let the OAuth callback exchange its PKCE code and choose the destination.
    const onAuthCallback = currentRoute === "auth";
    if (signedIn && !inAppArea && !onPasswordRecovery && !onAuthCallback) {
      const target = takeDestination();
      router.replace((target ?? "/dashboard") as "/dashboard");
    }
    if (!signedIn && inAppArea) { rememberDestination(pathname); router.replace("/sign-in"); }
  }, [sessionReady, signedIn, segments, router, pathname]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.background }}><SafeAreaProvider><MotionProvider><DevicePreferences><NetworkProvider><BottomSheetModalProvider>
      <StatusBar style={theme.dark ? "light" : "dark"} /><RouteFade>
      <Stack
        screenOptions={{
          animation: "none",
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.accent,
          headerTitleStyle: { fontWeight: "900", fontSize: 19, color: theme.foreground },
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
        <Stack.Screen name="web" options={{ title: "HoopCheck" }} />
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
      </Stack></RouteFade>
      {signedIn ? <TabBar /> : null}<Onboarding /><AppLock authReady={sessionReady} protectedScreen={signedIn && !["sign-in", "sign-up", "reset-password"].includes(segments[0] ?? "")} />
    </BottomSheetModalProvider></NetworkProvider></DevicePreferences></MotionProvider></SafeAreaProvider></GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
