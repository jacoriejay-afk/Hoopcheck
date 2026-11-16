import "react-native-url-polyfill/auto";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { createClient, processLock } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function validateSupabaseUrl(value: string | undefined): string | null {
  if (!value) return "Supabase URL is missing from this build.";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
        (url.pathname !== "/" && url.pathname !== "") ||
        !/^[a-z0-9-]+\\.supabase\\.co$/i.test(url.hostname)) {
      return "Supabase URL must be the HTTPS project base URL without a path or query.";
    }
    return null;
  } catch {
    return "Supabase URL is malformed in this build.";
  }
}

export const supabaseConfigurationError =
  validateSupabaseUrl(supabaseUrl) ||
  (!supabaseKey || supabaseKey === "placeholder-publishable-key"
    ? "Supabase publishable key is missing from this build."
    : null);

const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const webStorage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseKey || "placeholder-publishable-key",
  {
    auth: {
      storage: Platform.OS === "web" ? webStorage : secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  },
);

if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
