import AsyncStorage from "@react-native-async-storage/async-storage";

const prefix = "hoopcheck:public-cache:v1:";
export const maxCacheAge = 24 * 60 * 60 * 1000;
const maxBytes = 64 * 1024;
type Entry<T> = { savedAt: number; data: T };
export async function readCache<T>(key: string): Promise<Entry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(prefix + key);
    if (!raw || raw.length > maxBytes) return null;
    const entry = JSON.parse(raw) as Entry<T>;
    if (!Number.isFinite(entry.savedAt) || Date.now() < entry.savedAt || Date.now() - entry.savedAt > maxCacheAge) return null;
    return entry;
  } catch { return null; }
}
export async function writeCache<T>(key: string, data: T) {
  try {
    const value = JSON.stringify({ savedAt: Date.now(), data });
    if (value.length > maxBytes) return;
    await AsyncStorage.setItem(prefix + key, value);
    const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(prefix));
    // Bounded disk usage; cache loss only affects offline availability.
    if (keys.length > 80) await AsyncStorage.multiRemove(keys.filter(other => other !== prefix + key).slice(0, keys.length - 80));
  } catch { /* Storage failure must not fail a successful request. */ }
}
export async function clearPublicCache() {
  const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(prefix));
  if (keys.length) await AsyncStorage.multiRemove(keys);
}
