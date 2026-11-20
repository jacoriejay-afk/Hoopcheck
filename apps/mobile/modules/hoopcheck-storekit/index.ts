import { requireOptionalNativeModule } from "expo-modules-core";
export type StoreKitNative = {
  addListener(event: "onTransaction", listener: (value: unknown) => void): { remove(): void };
  identity(): Promise<unknown>;
  products(): Promise<unknown>;
  purchase(id: string, owner: string, identityID: string, introJWS: string, price: string, currency: string): Promise<unknown>;
  transactions(): Promise<unknown>;
  restore(): Promise<unknown>;
  finish(id: string): Promise<void>;
  manage(): Promise<void>;
};
// Existing builds, Expo Go, Android and web can load the app without this module.
// Missing native purchasing support never blocks startup or authentication.
export default requireOptionalNativeModule<StoreKitNative>("HoopcheckStoreKit");
