import {requireOptionalNativeModule} from "expo-modules-core";
import {Platform} from "react-native";
// Not wired into the membership screen. No storefront request at startup.
type PlayReadOnlyNative={queryCatalog():Promise<unknown>};
export const playReadOnlyNative=Platform.OS==="android"?requireOptionalNativeModule<PlayReadOnlyNative>("HoopcheckPlayBilling"):null;
