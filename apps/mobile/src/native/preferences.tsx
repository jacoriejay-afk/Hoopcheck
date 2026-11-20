import { setThemePreference } from "./themePreference";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { readWithDeadline } from "./readDeadline";
import { createPreferenceWriter, defaultPreferences, restorePreferences, type Preferences } from "./preferenceStore";
export type { Role } from "./preferenceStore";
const key = "hoopcheck:device-preferences:v1";
const Context = createContext({ preferences: defaultPreferences, ready: false, restoreError: "", retryRestore: async () => {}, update: (async () => {}) as (value: Partial<Preferences>) => Promise<void> });

export function DevicePreferences({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(defaultPreferences);
  const writer = useRef<ReturnType<typeof createPreferenceWriter> | null>(null);
  const [ready, setReady] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const generation = useRef(0);
  const retryRestore = useCallback(async () => {
    const current = ++generation.current;
    setReady(false); setRestoreError("");
    try {
      const next = restorePreferences(await readWithDeadline(() => AsyncStorage.getItem(key)));
      if (current !== generation.current) return;
      writer.current = createPreferenceWriter(next, value => AsyncStorage.setItem(key, JSON.stringify(value)));
      setPreferences(next); setReady(true);
    } catch {
      if (current === generation.current) setRestoreError("Couldn’t restore device settings. Your saved security settings have not been changed.");
    }
  }, []);
  useEffect(() => {
    void retryRestore();
    return () => { generation.current++; writer.current = null; };
  }, [retryRestore]);
  useEffect(() => { if (ready) setThemePreference(preferences.theme); }, [ready, preferences.theme]);
  async function update(value: Partial<Preferences>) {
    if (!writer.current) throw new Error("Device preferences are not ready");
    const currentWriter = writer.current;
    const next = await currentWriter.update(value);
    if (writer.current === currentWriter) setPreferences(next);
  }
  return <Context.Provider value={{ preferences, ready, restoreError, retryRestore, update }}>{children}</Context.Provider>;
}
export const useDevicePreferences = () => useContext(Context);
