import "react-native-gesture-handler";
import { StoreKitProvider } from "../src/native/storekit";
import { NativeDraftProvider } from "../src/native/drafts";
import { MfaSessionProvider } from "../src/native/mfa";
import { NativeAccountProvider } from "../src/native/useNativeAccount";
import { useFonts } from "expo-font";
import { rememberDestination, takeDestination } from "../src/native/pendingDestination";
import { AccessibilityInfo } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import * as SplashScreen from "expo-splash-screen";
import { DevicePreferences } from "../src/native/preferences";
import { NetworkProvider } from "../src/native/network";
import { MotionProvider } from "../src/motion/Provider";
import { AppLock } from "../components/AppLock";
import { AppOpening } from "../components/AppOpening";
import { NativePageHeader } from "../components/NativePageHeader";
import { TabBar } from "../components/TabBar";
import { RouteFade } from "../components/RouteFade";
import { motion } from "../src/motion/config";
import { traceFlow, Sentry } from "../src/native/telemetry";

void SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: motion.logo, fade: true });
void AccessibilityInfo.isReduceMotionEnabled().then(reduced => SplashScreen.setOptions({ duration: reduced ? motion.shortFade : motion.logo, fade: true })).catch(() => {});
const splashDeadline = setTimeout(() => { void SplashScreen.hideAsync().catch(() => {}); }, motion.splashDeadline - motion.logo);
import { useEffect, useRef, useState } from "react";
import { createSessionBootstrap, type StartupSession } from "../src/native/sessionBootstrap";
import { Stack, useGlobalSearchParams, usePathname, useRouter, useSegments } from "expo-router";
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
  const [session, setSession] = useState<StartupSession>({ ready: false, userId: null, error: null });
  const bootstrap = useRef<ReturnType<typeof createSessionBootstrap> | null>(null);
  const sessionReady = session.ready;
  const signedIn = Boolean(session.userId);
  const pathname = usePathname();
  const routeParams = useGlobalSearchParams<{ post?: string | string[]; q?: string | string[]; gameId?: string | string[] }>();

  useEffect(() => {
    bootstrap.current = createSessionBootstrap(
      () => traceFlow("startup", () => supabase.auth.getSession()),
      receive => {
        const { data } = supabase.auth.onAuthStateChange((_event, next) => receive(next));
        return () => data.subscription.unsubscribe();
      }, setSession,
    );
    return () => {
      bootstrap.current?.dispose(); bootstrap.current = null;
    };
  }, []);

  useEffect(() => {
    if (sessionReady && (fontsLoaded || fontError)) {
      clearTimeout(splashDeadline);
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [sessionReady, fontsLoaded, fontError]);

  useEffect(() => {
    if (!sessionReady || segments[0] === "about") return;
    const currentRoute = segments[0] ?? "";
    const inAppArea = ["dashboard", "team-hub", "fan-live", "notifications", "messages", "feed-welcome", "hoopgroups", "feed", "fan-feed", "reels", "account", "search", "teams", "womens", "leagues", "players", "coaches", "choose-username", "settings", "membership"].includes(currentRoute);
    if (["web", "sign-in", "sign-up"].includes(currentRoute)) return;
    const onPasswordRecovery = currentRoute === "reset-password";
    // Let the OAuth callback exchange its PKCE code and choose the destination.
    const onAuthCallback = currentRoute === "auth";
    const designProtected = currentRoute === "connections";
    if (signedIn && !(inAppArea || designProtected) && !onPasswordRecovery && !onAuthCallback) {
      const target = takeDestination();
      router.replace((target ?? "/dashboard") as "/dashboard");
    }
    if (!signedIn && (inAppArea || designProtected)) {
      const query = new URLSearchParams();
      if (currentRoute === "feed" && typeof routeParams.post === "string" && /^[0-9a-f-]{36}$/i.test(routeParams.post)) query.set("post", routeParams.post);
      if (currentRoute === "fan-live" && typeof routeParams.gameId === "string" && /^[0-9a-f-]{36}$/i.test(routeParams.gameId)) query.set("gameId", routeParams.gameId);
      if (currentRoute === "search" && typeof routeParams.q === "string") query.set("q", routeParams.q.slice(0, 100));
      const suffix = query.toString();
      rememberDestination(pathname + (suffix ? `?${suffix}` : "")); router.replace("/sign-in");
    }
  }, [sessionReady, signedIn, segments, router, pathname, routeParams.post, routeParams.q, routeParams.gameId]);

  // Mount the navigator on the first render. Font loading must never prevent
  // Router from mounting or leave a blank screen after the splash deadline.
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.background }}><SafeAreaProvider><MotionProvider><DevicePreferences><NetworkProvider><MfaSessionProvider userId={session.userId}><NativeAccountProvider><StoreKitProvider><NativeDraftProvider><BottomSheetModalProvider>
      <StatusBar style={theme.dark ? "light" : "dark"} /><RouteFade>
      <Stack
        screenOptions={{
          animation: "none",
          header: ({ navigation, options, route, back }) => <NativePageHeader title={options.title || route.name} onBack={back ? () => navigation.goBack() : undefined} />,
          headerStyle: { backgroundColor: "transparent" },
          headerTintColor: theme.accent,
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: "HoopCheckDisplay", fontSize: 21, color: theme.foreground },
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen name="connections" options={{ title: "Connections" }} />
        <Stack.Screen name="about" options={{ title: "About HoopCheck" }} />
        <Stack.Screen name="team-hub/groups/index" options={{ title: "HoopGroups" }} />
        <Stack.Screen name="team-hub/groups/[teamId]" options={{ title: "Club group" }} />
        <Stack.Screen name="fan-live" options={{ title: "Live Games" }} />
        <Stack.Screen name="notifications" options={{ title: "Alerts", headerShown: false }} />
        <Stack.Screen name="messages" options={{ title: "HoopChat" }} />
        <Stack.Screen name="feed-welcome" options={{ title: "HoopFeed Welcome" }} />
        <Stack.Screen name="hoopgroups" options={{ title: "HoopGroups Communities" }} />
        <Stack.Screen name="feed" options={{ headerShown: false }} />
        <Stack.Screen name="fan-feed" options={{ headerShown: false }} />
        <Stack.Screen name="reels" options={{ headerShown: false }} />
        <Stack.Screen name="account" options={{ headerShown: false }} />
        <Stack.Screen name="membership" options={{ title: "Membership" }} />
        <Stack.Screen name="account/edit" options={{ title: "Edit profile" }} />
        <Stack.Screen name="account/security" options={{ title: "Account security" }} />
        <Stack.Screen name="account/owner-hq" options={{ title: "Owner HQ" }} />
        <Stack.Screen name="account/ambassador-hq" options={{ title: "Ambassador HQ" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
        <Stack.Screen name="web" options={{ title: "HoopCheck" }} />
        <Stack.Screen name="index" options={{ title: "HoopCheck™", headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="auth/callback" options={{ title: "Signing in" }} />
        <Stack.Screen name="sign-up" options={{ headerShown: false }} />
        <Stack.Screen name="choose-username" options={{ title: "Choose username" }} />
        <Stack.Screen name="forgot-password" options={{ title: "Reset password" }} />
        <Stack.Screen name="reset-password" options={{ title: "Choose new password" }} />
        <Stack.Screen name="dashboard" options={{ title: "Home", headerShown: false, contentStyle: { backgroundColor: theme.background } }} />
        <Stack.Screen name="players" options={{ title: "Find players" }} />
        <Stack.Screen name="players/[id]" options={{ title: "Player profile", headerTransparent: true }} />
        <Stack.Screen name="coaches" options={{ title: "Find a coach" }} />
        <Stack.Screen name="womens/index" options={{ title: "Women’s teams" }} />
        <Stack.Screen name="womens/leagues/[id]" options={{ title: "League profile", headerTransparent: true }} />
        <Stack.Screen name="womens/[id]" options={{ title: "Team profile", headerTransparent: true }} />
        <Stack.Screen name="search" options={{ title: "Search & Explore" }} />
        <Stack.Screen name="teams" options={{ title: "Teams" }} />
        <Stack.Screen name="teams/[id]" options={{ title: "Team profile", headerTransparent: true }} />
        <Stack.Screen name="teams/[id]/review" options={{ title: "Write a review" }} />
        <Stack.Screen name="leagues" options={{ title: "Leagues" }} />
        <Stack.Screen name="leagues/[id]" options={{ title: "League profile", headerTransparent: true }} />
      </Stack></RouteFade>
      {signedIn ? <TabBar /> : null}<AppLock authReady={sessionReady} userId={session.userId} startupError={session.error} retryStartup={() => { void bootstrap.current?.retry(); }} protectedScreen={signedIn && !["sign-in", "sign-up", "reset-password", "auth"].includes(segments[0] ?? "")} />
      <AppOpening ready={sessionReady && (fontsLoaded || Boolean(fontError))}
        disabled={["auth", "reset-password"].includes(segments[0] ?? "")} />
    </BottomSheetModalProvider></NativeDraftProvider></StoreKitProvider></NativeAccountProvider></MfaSessionProvider></NetworkProvider></DevicePreferences></MotionProvider></SafeAreaProvider></GestureHandlerRootView>


  );
}

export default Sentry.wrap(RootLayout);
