import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { useRouter } from "expo-router";
import { supabase, supabaseConfigurationError } from "../src/lib/supabase";
import { pendingSignup } from "../src/native/socialSignup";
import { recordFreshSignIn } from "../src/native/lockPolicy";
import { takeDestination } from "../src/native/pendingDestination";
import type { Session, User } from "@supabase/supabase-js";

type AppleCredentials = { provider: "apple"; token: string; nonce: string };
type Exchange = (credentials: AppleCredentials) => Promise<{ data: { user: User | null; session: Session | null }; error: unknown }>;
type Props = { disabled: boolean; onBusyChange: (busy: boolean) => void };
export default function AppleSignIn({ disabled, onBusyChange }: Props) {
  const router = useRouter();
  const [available, setAvailable] = useState(false);
  const active = useRef(true);
  const busy = useRef(false);
  useEffect(() => {
    active.current = true;
    // Keep the feature disabled until the backend onboarding and revocation
    // contracts, credentials and signed device tests have been approved.
    if (process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED === "true") {
      void AppleAuthentication.isAvailableAsync().then(value => { if (active.current) setAvailable(value); }).catch(() => {});
    }
    return () => { active.current = false; };
  }, []);

  async function signIn() {
    if (disabled || busy.current || !available) return;
    if (supabaseConfigurationError) { Alert.alert("Setup required", supabaseConfigurationError); return; }
    const begin = (supabase.auth as unknown as Record<symbol, unknown>)[Symbol.for("hoopcheck.id-token-prompt")];
    if (typeof begin !== "function") { Alert.alert("Apple sign-in unavailable", "Please sign in using another method."); return; }
    busy.current = true;
    onBusyChange(true);
    try {
      // Capture the intent before invoking Apple; never fall back to an unguarded exchange.
      const exchange = (begin as () => Exchange)();
      const random = await Crypto.getRandomBytesAsync(32);
      const nonce = Array.from(random, byte => byte.toString(16).padStart(2, "0")).join("");
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
      if (!active.current) return;
      const credentials = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL, AppleAuthentication.AppleAuthenticationScope.FULL_NAME],
        nonce: hashedNonce,
      });
      if (!active.current) return;
      if (!credentials.identityToken) throw new Error("Apple returned no identity token.");
      const result = await exchange({ provider: "apple", token: credentials.identityToken, nonce });
      if (result.error || !result.data.user || !result.data.session || !active.current) throw new Error("Apple identity could not be verified.");
      const uid = result.data.user.id;
      const current = await supabase.auth.getSession();
      if (!active.current || current.error || current.data.session?.user.id !== uid) return;
      if (pendingSignup(result.data.user)) {
        router.replace({ pathname: "/sign-up", params: { social: "1" } });
        return;
      }
      if (result.data.user.role !== "authenticated") throw new Error("Account setup is incomplete.");
      const profile = await supabase.from("profiles").select("username").eq("id", uid).maybeSingle();
      const finalSession = await supabase.auth.getSession();
      if (!active.current || finalSession.error || finalSession.data.session?.user.id !== uid) return;
      if (profile.error || !profile.data) throw new Error("Account profile could not be verified.");
      recordFreshSignIn(uid);
      router.replace((!profile.data.username?.trim() ? "/choose-username" : takeDestination() ?? "/dashboard") as "/dashboard");
    } catch (error) {
      if (active.current && !(typeof error === "object" && error && "code" in error && error.code === "ERR_REQUEST_CANCELED")) {
        Alert.alert("Apple sign-in unavailable", "Please try again or use your existing sign-in method.");
      }
    } finally {
      busy.current = false;
      if (active.current) onBusyChange(false);
    }
  }

  if (!available) return null;
  return <AppleAuthentication.AppleAuthenticationButton
    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
    cornerRadius={14}
    style={{ width: "100%", height: 52, marginTop: 8, opacity: disabled ? 0.55 : 1 }}
    onPress={() => void signIn()}
  />;
}
