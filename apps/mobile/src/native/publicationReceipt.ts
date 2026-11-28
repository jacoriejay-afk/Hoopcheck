import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import { publicationStorageKey,publicationIdPattern,resolvePublication } from "./publicationReceiptCore";
export const publicationReceiptsEnabled=process.env.EXPO_PUBLIC_HOOPCHECK_FEED_PUBLICATION_RECEIPTS_ENABLED==="true";
const locks=new Set<string>();
export async function sendWithPublicationReceipt(owner:string,send:(id?:string)=>Promise<void>){
 if(!publicationReceiptsEnabled)return send();
 const storageKey=publicationStorageKey(owner);
 if(locks.has(storageKey))throw Error("A publication is already in progress.");
 locks.add(storageKey);
 try{
  if(await AsyncStorage.getItem(storageKey))throw Error("Check the previous publication before starting another post.");
  const id=randomUUID();
  await AsyncStorage.setItem(storageKey,id);
  await send(id);
  if(await AsyncStorage.getItem(storageKey)===id)await AsyncStorage.removeItem(storageKey);
 }finally{locks.delete(storageKey);}
}
export async function recoverNativePublication(origin:string,owner:string,token:string){
 const storageKey=publicationStorageKey(owner);
 if(locks.has(storageKey))throw Error("A publication is in progress.");
 locks.add(storageKey);
 try{
  const id=await AsyncStorage.getItem(storageKey);
  if(!id)return null;
  if(!publicationIdPattern.test(id))throw Error("Invalid pending publication. Contact support.");
  const state=await resolvePublication(origin,token,id,true);
  if(await AsyncStorage.getItem(storageKey)===id)await AsyncStorage.removeItem(storageKey);
  return state;
 }finally{locks.delete(storageKey);}
}
