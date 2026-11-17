import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export type Role = "player" | "fan" | "coach" | "agent" | "scout" | "manager";
type Preferences = { haptics: boolean; appLock: boolean; onboardingDone: boolean; role?: Role };
const defaults: Preferences = { haptics: true, appLock: false, onboardingDone: false };
const key = "hoopcheck:device-preferences:v1";
const Context = createContext({ preferences: defaults, ready: false, update: (async () => {}) as (value: Partial<Preferences>) => Promise<void> });

export function DevicePreferences({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(defaults);
  const current = useRef(defaults);
  const writes = useRef(Promise.resolve());
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(key).then(value => {
      if (!active || !value) return;
      const parsed = JSON.parse(value);
      const next = { ...defaults, ...parsed };
      current.current = next;
      setPreferences(next);
    }).catch(() => {}).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  async function update(value: Partial<Preferences>) {
    const next = { ...current.current, ...value };
    // Serialize writes so completing onboarding cannot be overwritten by an older setting.
    const pending = writes.current.catch(() => {}).then(() => AsyncStorage.setItem(key, JSON.stringify(next)));
    writes.current = pending;
    current.current = next;
    await pending;
    setPreferences(next);
  }
  return <Context.Provider value={{ preferences, ready, update }}>{children}</Context.Provider>;
}
export const useDevicePreferences = () => useContext(Context);
