import "react-native-url-polyfill/auto";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { createClient, processLock } from "@supabase/supabase-js";
import { createAuthIntents, browserAuthIntentStore, guardAuthResponses, bindAuthIntents } from "../../../../lib/auth/auth-intents";
import { serializeAuthStorage } from "../../../../lib/auth/serialized-storage";
import { validateSupabaseUrl } from "./supabase-url";
import { readWithDeadline } from "../native/readDeadline";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const projectUrl = supabaseUrl?.trim();
const publishableKey = supabaseKey?.trim();

export const supabaseConfigurationError =
  validateSupabaseUrl(projectUrl) ||
  (!publishableKey || publishableKey === "placeholder-publishable-key"
    ? "Supabase publishable key is missing from this build."
    : null);

const serializedSecureStorage = serializeAuthStorage({
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
});
const secureStorage = { ...serializedSecureStorage, getItem: (key: string) => readWithDeadline(() => serializedSecureStorage.getItem(key)) };

const webStorage = {
  getItem: (key: string) => readWithDeadline(() => AsyncStorage.getItem(key)),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

const authIntents = createAuthIntents(Platform.OS === "web" ? browserAuthIntentStore(supabaseConfigurationError ? "https://placeholder.supabase.co" : projectUrl!) : undefined);
export const supabase = createClient(
  supabaseConfigurationError ? "https://placeholder.supabase.co" : projectUrl!,
  supabaseConfigurationError ? "placeholder-publishable-key" : publishableKey!,
  {
    global: { fetch: guardAuthResponses(supabaseConfigurationError ? "https://placeholder.supabase.co" : projectUrl!, authIntents) },
    auth: {
      storage: Platform.OS === "web" ? webStorage : secureStorage,
      autoRefreshToken: !supabaseConfigurationError,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce",
      lock: processLock,
    },
  },
);

bindAuthIntents(supabase.auth, authIntents);

if (!supabaseConfigurationError && Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
