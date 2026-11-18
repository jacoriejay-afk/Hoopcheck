import { setThemePreference } from "./themePreference";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPreferenceWriter, defaultPreferences, restorePreferences, type Preferences } from "./preferenceStore";
export type { Role } from "./preferenceStore";
const key = "hoopcheck:device-preferences:v1";
const Context = createContext({ preferences: defaultPreferences, ready: false, update: (async () => {}) as (value: Partial<Preferences>) => Promise<void> });

export function DevicePreferences({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(defaultPreferences);
  const writer = useRef<ReturnType<typeof createPreferenceWriter> | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    const restore = async () => {
      let next: Preferences;
      try { next = restorePreferences(await AsyncStorage.getItem(key)); }
      catch { next = { ...defaultPreferences, appLock: true }; }
      if (!active) return;
      writer.current = createPreferenceWriter(next, value => AsyncStorage.setItem(key, JSON.stringify(value)));
      setPreferences(next); setReady(true);
    };
    void restore();
    return () => { active = false; writer.current = null; };
  }, []);
  useEffect(() => { if (ready) setThemePreference(preferences.theme); }, [ready, preferences.theme]);
  async function update(value: Partial<Preferences>) {
    if (!writer.current) throw new Error("Device preferences are not ready");
    const currentWriter = writer.current;
    const next = await currentWriter.update(value);
    if (writer.current === currentWriter) setPreferences(next);
  }
  return <Context.Provider value={{ preferences, ready, update }}>{children}</Context.Provider>;
}
export const useDevicePreferences = () => useContext(Context);
