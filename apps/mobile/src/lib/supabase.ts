import "react-native-url-polyfill/auto";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { createClient, processLock } from "@supabase/supabase-js";
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

const secureStorage = {
  getItem: (key: string) => readWithDeadline(() => SecureStore.getItemAsync(key)),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const webStorage = {
  getItem: (key: string) => readWithDeadline(() => AsyncStorage.getItem(key)),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

export const supabase = createClient(
  supabaseConfigurationError ? "https://placeholder.supabase.co" : projectUrl!,
  supabaseConfigurationError ? "placeholder-publishable-key" : publishableKey!,
  {
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

if (!supabaseConfigurationError && Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
