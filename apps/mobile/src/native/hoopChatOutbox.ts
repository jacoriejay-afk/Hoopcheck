import AsyncStorage from "@react-native-async-storage/async-storage";
import {randomUUID} from "expo-crypto";
import {createChatOutbox} from "./hoopChatOutboxCore";
const locks=new Set<string>();
export const nativeChatOutbox=createChatOutbox({get:key=>AsyncStorage.getItem(key),set:(key,value)=>AsyncStorage.setItem(key,value),remove:key=>AsyncStorage.removeItem(key)},async(key,run)=>{
 if(locks.has(key))throw Error("Message delivery is already being checked.");
 locks.add(key);try{return await run();}finally{locks.delete(key);}
},randomUUID);
