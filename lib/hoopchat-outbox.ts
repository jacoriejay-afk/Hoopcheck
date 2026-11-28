import {createChatOutbox} from "../apps/mobile/src/native/hoopChatOutboxCore";
export const webChatOutbox=createChatOutbox({get:async key=>window.localStorage.getItem(key),set:async(key,value)=>window.localStorage.setItem(key,value),remove:async key=>window.localStorage.removeItem(key)},async(key,run)=>{
 if(!navigator.locks)throw Error("Durable message recovery is unavailable in this browser.");
 return navigator.locks.request(key,{mode:"exclusive",ifAvailable:true},async lock=>{
  if(!lock)throw Error("Message delivery is already being checked.");
  return run();
 });
},()=>crypto.randomUUID());
