import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
function compile(path, imports, globals = {}) {
  const js = ts.transpileModule(source(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const compiled = { exports: {} };
  new Function("require", "exports", "module", ...Object.keys(globals), js)(imports, compiled.exports, compiled, ...Object.values(globals));
  return compiled.exports;
}
function recoveryModule() {
  return compile("../../lib/auth/password-recovery.ts", name => { throw new Error(`Unexpected recovery dependency ${name}`); });
}
function nativeLinks() {
  return compile("src/native/deepLinks.ts", name => {
    if (name === "./supportTopic.ts") return compile("src/native/supportTopic.ts", () => { throw new Error("Unexpected support dependency"); });
    if (name.endsWith("/password-recovery.ts")) return recoveryModule();
    throw new Error(`Unexpected link dependency ${name}`);
  });
}
const theme = { radius: { control: 12 }, spacing: { lg: 16 }, roles: {}, entityHero: { background: "#111827", ink: "#FFFFFF", muted: "#E5E7EB" }, type: { display: {} } };
function screen(path, { state = [], params = {}, segments = [], pathname = "/", configurationError = null, pendingDestination = null, fontsLoaded = true, supabase = {}, width = 393, fontScale = 1, careerEnabled = false, careerStorage = new Map() } = {}) {
  const calls = { push: [], replace: [], alerts: [], oauthUrls: [], freshSignIns: 0, remembered: [] };
  const effects = [];
  let slot = 0;
  const router = { push: p => calls.push.push(p), replace: p => calls.replace.push(p) };
  function Stack() {}
  Stack.Screen = "Screen";
  const imports = name => {
    if (name === "react") return { useRef: value => ({ current: value }), useState: initial => [state[slot++] ?? initial, () => {}], useEffect: f => effects.push(f) };
    if (name === "react-native") return { useWindowDimensions: () => ({ width, fontScale, height: 852, scale: 3 }), Platform: { OS: "ios", select: options => options.ios }, StyleSheet: { create: s => s, absoluteFill: {} }, Alert: { alert: (...args) => calls.alerts.push(args) }, AccessibilityInfo: { isReduceMotionEnabled: async () => false }, Image: "Image", ScrollView: "ScrollView", Text: "Text", View: "View", Pressable: "Pressable", KeyboardAvoidingView: "KeyboardAvoidingView", ActivityIndicator: "ActivityIndicator" };
    if (name === "expo-router") return { Stack, Link: "Link", useRouter: () => router, useLocalSearchParams: () => params, useGlobalSearchParams: () => params, useSegments: () => segments, usePathname: () => pathname };
    if (name === "expo-linking") return { createURL: p => `hoopcheck://${p}`, openURL: async url => calls.oauthUrls.push(url) };
    if (name === "expo-font") return { useFonts: () => [fontsLoaded, null] };
    if (name === "expo-status-bar") return { StatusBar: "StatusBar" };
    if (name === "react-native-safe-area-context") return { SafeAreaView: "SafeAreaView", SafeAreaProvider: "SafeAreaProvider" };
    if (name.endsWith("/theme")) return { useEntryTheme: () => theme };
    if (name === "expo-linear-gradient") return { LinearGradient: "LinearGradient" };
    if (name.endsWith("/BrandLogo")) return { BrandLogo: "BrandLogo" };
    if (name.endsWith("/ArenaBrand")) return { ArenaBrand: "ArenaBrand" };
    if (name.endsWith("/AppleSignIn")) return { __esModule: true, default: "AppleSignIn" };
    if (name.endsWith("/AppOpening")) return { AppOpening: "AppOpening" };
    if (name === "@expo/vector-icons") return { Ionicons: "Ionicons" };
    if (name === "react-native-reanimated") return { __esModule: true, default: { View: "AnimatedView" },
      useSharedValue: initial => ({ get: () => initial, set() {} }),
      useAnimatedStyle: render => render(), withTiming: value => value };

    if (name.endsWith("/ExploreLinks")) return { ExploreLinks: "ExploreLinks" };
    if (name.endsWith("/primitives")) return { GlassCard: "GlassCard", Input: "Input", Button: "Button", SectionHeader: "SectionHeader" };
    if (name.endsWith("/supabase")) return { supabase, supabaseConfigurationError: configurationError };
    if (name.endsWith("/native/deepLinks")) return nativeLinks();
    if (name.endsWith("/auth/password-recovery")) return recoveryModule();
    if (name.endsWith("/native/sessionBootstrap")) return { createSessionBootstrap: () => ({ retry() {}, dispose() {} }) };
    if (name.endsWith("/native/lockPolicy")) return { recordFreshSignIn: () => { calls.freshSignIns++; } };
    if (name.endsWith("/native/pendingDestination")) return { takeDestination: () => pendingDestination, rememberDestination: value => calls.remembered.push(value) };
    if (name.endsWith("/native/careerClaims")) return { nativeCareerClaimsEnabled: careerEnabled };
    if (name.endsWith("/native/careerSignup")) return compile("src/native/careerSignup.ts", require);
    if (name.endsWith("/native/socialSignup")) return compile("src/native/socialSignup.ts", require);
    if (name === "@react-native-async-storage/async-storage") return { __esModule: true, default: { getItem: async key => careerStorage.get(key) ?? null, setItem: async (key, value) => { careerStorage.set(key, value); }, removeItem: async key => { careerStorage.delete(key); } } };
    if (name === "react-native-gesture-handler") return { GestureHandlerRootView: "GestureHandlerRootView" };
    if (name === "@gorhom/bottom-sheet") return { BottomSheetModalProvider: "BottomSheetModalProvider" };
    if (name === "expo-splash-screen") return { preventAutoHideAsync: async () => {}, setOptions: () => {}, hideAsync: async () => {} };
    if (name.endsWith("/native/storekit")) return { StoreKitProvider: "StoreKitProvider" };
    if (name.endsWith("/native/mfa")) return { MfaSessionProvider: "MfaSessionProvider" };
    if (name.endsWith("/native/preferences")) return { DevicePreferences: "DevicePreferences" };
    if (name.endsWith("/native/drafts")) return { NativeDraftProvider: "NativeDraftProvider" };
    if (name.endsWith("/native/useNativeAccount")) return { NativeAccountProvider: "NativeAccountProvider" };
    if (name.endsWith("/native/network")) return { NetworkProvider: "NetworkProvider" };
    if (name.endsWith("/motion/Provider")) return { MotionProvider: "MotionProvider", useMotionSetting: () => true };
    if (name.endsWith("/motion/config")) return { motion: { logo: 300, shortFade: 100, splashDeadline: 2000 } };
    if (name.endsWith("/native/telemetry")) return { traceFlow: (_, fn) => fn(), Sentry: { wrap: component => component } };
    if (name.endsWith("/Onboarding")) return { Onboarding: "Onboarding" };
    if (name.endsWith("/PublicSystemLinks")) return { PublicSystemNavigation: "PublicSystemNavigation" };
    if (name.endsWith("/AppLock")) return { AppLock: "AppLock" };
    if (name.endsWith("/NativePageHeader")) return { NativePageHeader: "NativePageHeader" };
    if (name.endsWith("/TabBar")) return { TabBar: "TabBar" };
    if (name.endsWith("/supportTopic")) return { supportTopic: value => value === "scam" ? value : null };
    if (/\.(png|ttf)$/.test(name)) return 1;
    return require(name);
  };
  const Component = compile(path, imports).default;
  const tree = Component();
  function nodes(node) {
    if (!node || typeof node !== "object") return [];
    return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
  }
  return { calls, effects, nodes: nodes(tree) };
}
const profile = username => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { username } }) }) }) }) });

test("themed welcome buttons navigate explicitly to sign-in and sign-up", () => {
  const f = screen("app/index.tsx");
  const buttons = f.nodes.filter(n => n.type === "Button" && ["Sign in", "Create an account"].includes(n.props.accessibilityLabel));
  assert.equal(buttons.length, 2);
  buttons.find(b => b.props.accessibilityLabel === "Sign in").props.onPress();
  buttons.find(b => b.props.accessibilityLabel === "Create an account").props.onPress();
  assert.deepEqual(f.calls.push, ["/sign-in", "/sign-up"]);
  assert.ok(f.nodes.some(n => n.props.accessibilityRole === "header"));
});

test("welcome adapts search and account actions to narrow screens and large text without changing destinations", () => {
  for (const [width, fontScale, expected] of [[393, 1, "row"], [320, 1, "column"], [393, 1.6, "column"], [768, 1, "row"]]) {
    const f = screen("app/index.tsx", { width, fontScale, state: ["  basketball  "] });
    const search = f.nodes.find(n => n.type === "Input");
    const searchRow = f.nodes.find(n => n.type === "View" && [n.props.children].flat().includes(search));
    const accountRow = f.nodes.find(n => n.type === "View" && [n.props.children].flat().some(child => child?.props?.accessibilityLabel === "Create an account"));
    assert.equal(searchRow.props.style.flexDirection, expected);
    assert.equal(accountRow.props.style.flexDirection, expected);
    search.props.onSubmitEditing();
    f.nodes.find(n => n.type === "Button" && n.props.accessibilityLabel === "Search").props.onPress();
    assert.deepEqual(f.calls.push, [
      { pathname: "/search", params: { q: "basketball" } },
      { pathname: "/search", params: { q: "basketball" } },
    ]);
    const shortcuts = f.nodes.filter(n => n.type === "Pressable" && n.props.accessibilityRole === "button");
    assert.equal(shortcuts.length, 2);
    shortcuts.forEach(n => n.props.onPress());
    assert.deepEqual(f.calls.push.slice(2), ["/fan-live", "/pre-sign"]);
    assert.ok(shortcuts.every(n => n.props.style({ pressed: false }).minHeight >= 44));
  }
});

test("password sign-in normalizes email and retains profile destination selection", async () => {
  for (const [username, destination] of [["player", "/dashboard"], ["", "/choose-username"]]) {
    const requests = [];
    const f = screen("app/sign-in.tsx", { state: [" Player@Example.com ", "password"], supabase: {
      ...profile(username), auth: { signInWithPassword: async args => { requests.push(args); return { data: { user: { id: "user" } }, error: null }; } },
    } });
    await f.nodes.find(n => n.type === "Button" && !n.props.secondary).props.onPress();
    assert.deepEqual(requests, [{ email: "player@example.com", password: "password" }]);
    assert.deepEqual(f.calls.replace, [destination]);
    assert.ok(f.nodes.some(n => n.type === "Input" && n.props.secureTextEntry));
  }
});

test("career signup handoff preserves the role, identity, flag and pending-link gates", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const otherId = "22222222-2222-4222-8222-222222222222";
  const key = "hoopcheck:career-signup:v1:" + id;
  for (const [careerEnabled, role, sessionId, pendingDestination, expected, consumed] of [
    [true, "player", id, null, "/account/career-history", true],
    [true, "player", id, "/teams/fixture", "/teams/fixture", true],
    [true, "player", otherId, null, null, true],
    [false, "player", id, null, "/dashboard", false],
    [true, "fan", id, null, "/dashboard", false],
  ]) {
    const careerStorage = new Map([[key, String(Date.now())]]);
    const f = screen("app/sign-in.tsx", {
      careerEnabled, careerStorage, pendingDestination,
      state: ["player@example.com", "password"],
      supabase: {
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { username: "fixture", account_type: role } }) }) }) }),
        auth: { signInWithPassword: async () => ({ data: { user: { id } }, error: null }),
          getSession: async () => ({ data: { session: { user: { id: sessionId } } } }) },
      },
    });
    await f.nodes.find(n => n.type === "Button" && !n.props.secondary).props.onPress();
    assert.deepEqual(f.calls.replace, expected ? [expected] : []);
    assert.equal(careerStorage.has(key), !consumed);
    assert.deepEqual(f.calls.alerts, []);
  }
});

test("Google sign-in keeps the native PKCE callback and opens only a returned OAuth URL", async () => {
  const requests = [];
  const f = screen("app/sign-in.tsx", { supabase: { auth: { signInWithOAuth: async args => { requests.push(args); return { data: { url: "https://provider.invalid/authorize" }, error: null }; } } } });
  await f.nodes.find(n => n.type === "Button" && n.props.secondary).props.onPress();
  assert.deepEqual(requests, [{ provider: "google", options: { redirectTo: "hoopcheck://auth/callback", skipBrowserRedirect: true } }]);
  assert.deepEqual(f.calls.oauthUrls, ["https://provider.invalid/authorize"]);
});

test("invalid build configuration blocks both sign-in methods before any auth request", async () => {
  const f = screen("app/sign-in.tsx", { configurationError: "Invalid Supabase URL", state: ["player@example.com", "password"] });
  for (const button of f.nodes.filter(n => n.type === "Button")) await button.props.onPress();
  assert.equal(f.calls.alerts.length, 2);
  assert.ok(f.calls.alerts.every(a => a[0] === "Setup required"));
  assert.deepEqual(f.calls.oauthUrls, []);
  assert.deepEqual(f.calls.replace, []);
});

test("native recovery requests an HTTPS browser fallback and gives generic resend feedback", async () => {
  const requests = [];
  const f = screen("app/forgot-password.tsx", { state: [" Player@Example.com "], supabase: { auth: {
    resetPasswordForEmail: async (...args) => { requests.push(args); return { error: { code: "user_not_found" } }; },
  } } });
  const send = f.nodes.find(n => n.type === "Button");
  await send.props.onPress();
  await send.props.onPress();
  assert.deepEqual(requests, [["player@example.com", { redirectTo: "https://hoopcheck.online/recover-password" }]]);
  assert.match(f.calls.alerts[0][1], /If there’s an account/);
  assert.equal(f.calls.alerts[1][0], "Please wait");
});

test("layout does not interrupt callback exchange, but retains protected-route redirects", () => {
  for (const [segments, signedIn, expected] of [
    [["auth", "callback"], true, []], [["auth", "callback"], false, []],
    [["reset-password"], true, []], [["sign-in"], true, []],
    [["dashboard"], false, ["/sign-in"]],
  ]) {
    const f = screen("app/_layout.tsx", { state: [{ ready: true, userId: signedIn ? "user" : null, error: null }], segments });
    f.effects[2]();
    assert.deepEqual(f.calls.replace, expected);
  }
});

test("callback exchanges its code and selects the correct authenticated destination", async () => {
  for (const [username, destination] of [["player", "/dashboard"], ["", "/choose-username"]]) {
    const codes = [];
    const f = screen("app/auth/callback.tsx", { params: { code: "pkce-code" }, supabase: {
      ...profile(username), auth: { exchangeCodeForSession: async code => { codes.push(code); return { data: { user: { id: "user" } }, error: null }; } },
    } });
    f.effects[0]();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(codes, ["pkce-code"]);
    assert.deepEqual(f.calls.replace, [destination]);
  }
});

test("denied, missing-code and misconfigured callbacks never exchange or redirect", async () => {
  for (const options of [{ params: {} }, { params: { code: "code", error_description: "denied" } }, { params: { code: "code" }, configurationError: "Invalid URL" }]) {
    let exchanged = false;
    const f = screen("app/auth/callback.tsx", { ...options, supabase: { auth: { exchangeCodeForSession: async () => { exchanged = true; } } } });
    f.effects[0]();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(exchanged, false);
    assert.deepEqual(f.calls.replace, []);
  }
});


test("OS callback URL reaches native PKCE exchange rather than browser handoff", async () => {
  const links = nativeLinks();
  const intent = compile("app/+native-intent.tsx", name => {
    assert.equal(name, "../src/native/deepLinks"); return links;
  });
  const destination = intent.redirectSystemPath({ path: "hoopcheck://auth/callback?code=fixture-code", initial: true });
  assert.equal(destination.split("?")[0], "/auth/callback");
  const params = Object.fromEntries(new URL(destination, "https://fixture.example").searchParams);
  const codes = [];
  const f = screen("app/auth/callback.tsx", { params, supabase: {
    ...profile("fixture"), auth: { exchangeCodeForSession: async code => { codes.push(code); return { data: { user: { id: "user" } }, error: null }; } },
  } });
  f.effects[0](); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(codes, ["fixture-code"]);
  assert.deepEqual(f.calls.replace, ["/dashboard"]);
});


test("OAuth callback honors the pending destination after a verified fresh sign-in", async () => {
  const f = screen("app/auth/callback.tsx", { params: { code: "fixture-code" }, pendingDestination: "/teams/fixture", supabase: {
    ...profile("fixture"), auth: { exchangeCodeForSession: async () => ({ data: { user: { id: "user" } }, error: null }) },
  } });
  f.effects[0](); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.calls.replace, ["/teams/fixture"]);
  assert.equal(f.calls.freshSignIns, 1);
});

test("a provider error without description never exchanges a supplied code", async () => {
  let exchanged = false;
  const f = screen("app/auth/callback.tsx", { params: { code: "fixture", error: "access_denied" }, supabase: { auth: { exchangeCodeForSession: async () => { exchanged = true; } } } });
  f.effects[0](); await new Promise(resolve => setImmediate(resolve));
  assert.equal(exchanged, false);
  assert.equal(f.calls.freshSignIns, 0);
});

test("OAuth exchange screen does not trigger app lock before fresh sign-in is recorded", () => {
  for (const [segments, expected] of [[["auth", "callback"], false], [["dashboard"], true]]) {
    const f = screen("app/_layout.tsx", { state: [{ ready: true, userId: "user", error: null }], segments });
    assert.equal(f.nodes.find(node => node.type === "AppLock").props.protectedScreen, expected);
  }
});

test("public recovery screens never trigger onboarding or pending signup redirects", () => {
  for (const route of ["forgot-password", "reset-password"]) {
    const f = screen("app/_layout.tsx", { state: [{ ready: true, userId: "pending", error: null, pendingSocialSignup: true }], segments: [route] });
    f.effects[2]();
    assert.deepEqual(f.calls.replace, []);
    const lock = f.nodes.find(node => node.type === "AppLock");
    assert.equal(lock.props.allowOnboarding, false);
    assert.equal(lock.props.protectedScreen, false);
  }
});


test("protected native links preserve bounded post/search destinations without retaining auth secrets", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  for (const [segments, pathname, params, expected] of [
    [["feed"], "/feed", { post: id, code: "secret" }, `/feed?post=${id}`],
    [["feed"], "/feed", { post: "bad" }, "/feed"],
    [["fan-live"], "/fan-live", { gameId: id, code: "secret" }, `/fan-live?gameId=${id}`],
    [["search"], "/search", { q: "x".repeat(200), token: "secret" }, "/search?q=" + "x".repeat(100)],
  ]) {
    const f = screen("app/_layout.tsx", { state: [{ ready: true, userId: null, error: null }], segments, pathname, params });
    f.effects[2]();
    assert.deepEqual(f.calls.remembered, [expected]);
    assert.deepEqual(f.calls.replace, ["/sign-in"]);
  }
});


test("protected search retains a bounded query across sign-in without extra URL fields", () => {
  const f = screen("app/_layout.tsx", { state: [{ ready: true, userId: null, error: null }], segments: ["search"], pathname: "/search", params: { q: "x".repeat(200), token: "discard" } });
  f.effects[2](); assert.deepEqual(f.calls.remembered, ["/search?q=" + "x".repeat(100)]);
});


test("root navigator mounts before any redirect even if the display font never loads", () => {
  const f = screen("app/_layout.tsx", { fontsLoaded: false, state: [{ ready: true, userId: null, error: null }], segments: ["dashboard"] });
  assert.ok(f.nodes.some(node => typeof node.type === "function" && node.type.name === "Stack"));
  assert.deepEqual(f.calls.replace, []);
  f.effects[2]();
  assert.deepEqual(f.calls.replace, ["/sign-in"]);
});


test("pending social callback requires setup rather than consuming a protected destination", async () => {
  for (const provider of ["google", "apple"]) {
    const f = screen("app/auth/callback.tsx", {
      params: { code: "fixture" }, pendingDestination: "/teams/fixture",
      supabase: { auth: { exchangeCodeForSession: async () => ({
        data: { user: { id: "user", role: "hoopcheck_pending_signup", app_metadata: { provider } } }, error: null
      }) }, from: () => { throw new Error("Pending accounts must not query private profiles"); } }
    });
    f.effects[0](); await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(f.calls.replace, [{ pathname: "/sign-up", params: { social: "1" } }]);
    assert.equal(f.calls.freshSignIns, 0);
  }
});


test("restored pending social account resumes setup and hides member tabs", () => {
  for (const [segments, params, expected] of [
    [["dashboard"], {}, [{ pathname: "/sign-up", params: { social: "1" } }]],
    [["sign-up"], {}, [{ pathname: "/sign-up", params: { social: "1" } }]],
    [["sign-up"], { social: "1" }, []],
    [["sign-in"], {}, []],
    [["auth", "callback"], {}, []],
  ]) {
    const f = screen("app/_layout.tsx", { segments, params, state: [{ ready: true, userId: "pending", error: null, pendingSocialSignup: true }] });
    f.effects[2]();
    assert.deepEqual(f.calls.replace, expected);
    assert.equal(f.nodes.some(node => node.type === "TabBar"), false);
    assert.equal(f.nodes.find(node => node.type === "AppLock").props.protectedScreen, false);
  }
});
