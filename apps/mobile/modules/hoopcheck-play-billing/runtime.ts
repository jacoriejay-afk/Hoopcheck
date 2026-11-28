import {requireOptionalNativeModule} from "expo-modules-core";
import {Platform} from "react-native";
type NativeRuntime={
 isAccepted():boolean;
 launchReviewed(product:string,plan:string,price:string,currency:string,account:string,expires:number):Promise<unknown>;
 restoreReviewed(account:string):Promise<unknown>;
 invalidateScope():void;
 addListener(event:"onPlayPurchaseChanged",listener:()=>void):{remove():void};
};
export const playRuntimeNative=Platform.OS==="android"?requireOptionalNativeModule<NativeRuntime>("HoopcheckPlayRuntime"):null;
