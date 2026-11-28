import * as SecureStore from "expo-secure-store";
import {createPlayRecoveryJournal} from "./playRecoveryJournal";
const key="hoopcheck.play.sandbox.recovery.v1";
// No storage is accessed at import time. This singleton uses Android Keystore
// backed encrypted storage; never falls back to AsyncStorage or logs data.
export const playRecoveryJournal=createPlayRecoveryJournal({
 async read(){if(!await SecureStore.isAvailableAsync())throw Error("Recovery unavailable");return SecureStore.getItemAsync(key);},
 async write(value){if(!await SecureStore.isAvailableAsync())throw Error("Recovery unavailable");await SecureStore.setItemAsync(key,value);},
 async remove(){if(!await SecureStore.isAvailableAsync())throw Error("Recovery unavailable");await SecureStore.deleteItemAsync(key);}
});
