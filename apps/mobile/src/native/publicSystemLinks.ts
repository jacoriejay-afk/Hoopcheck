import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";
export const publicSystemPath = (value: unknown): "/teams" | "/womens" | "/leagues" | null =>
  value === "/teams" || value === "/womens" || value === "/leagues" ? value : null;
type Subscription = { remove(): void };
export const publicSystemLinks = Platform.OS === "ios" && process.env.EXPO_PUBLIC_HOOPCHECK_SYSTEM_LINKS_ENABLED === "true"
 ? requireOptionalNativeModule<{
  isEnabled():Promise<boolean>;
  setEnabled(enabled:boolean):Promise<boolean>;
  takePending():Promise<string|null>;
  addListener(event:"onPublicLink",callback:()=>void):Subscription;
 }>("HoopcheckPublicLinks") : null;
