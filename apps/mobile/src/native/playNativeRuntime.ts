import {createPlaySandboxBridge} from "./playSandboxBridge";
import {playRuntimeNative} from "../../modules/hoopcheck-play-billing/runtime";
import {playRecoveryJournal} from "./playRecoveryStorage";
type Ports=Parameters<typeof createPlaySandboxBridge>[0];
/** The native hard hold must independently pass, in addition to app/session
 * gating. This factory has no network defaults and cannot enable purchasing. */
export function createPlayNativeRuntime(p:Pick<Ports,"enabled"|"available"|"session"|"request"|"now">){
 const native=playRuntimeNative;
 const accepted=()=>native?.isAccepted()===true;
 let boundOwner:string|null=null;
 const coordinator=createPlaySandboxBridge({
  ...p,scope:"signed_sandbox",journal:playRecoveryJournal,enabled:()=>p.enabled()&&accepted(),
  native:{
   launch:i=>native?native.launchReviewed(i.productId,i.basePlanId,i.priceMicros,i.currency,i.accountId,i.expiresAt):Promise.resolve("held"),
   restore:a=>native?native.restoreReviewed(a):Promise.resolve(null)
  }
 });
 return {
  ...coordinator,available:()=>accepted()&&p.enabled()&&p.available(),
  invalidate(){coordinator.invalidate();native?.invalidateScope();},
  setOwner(owner:string|null){if(owner!==boundOwner){boundOwner=owner;coordinator.setOwner(owner);native?.invalidateScope();}},
  subscribe(onChange:()=>void){return native?.addListener("onPlayPurchaseChanged",onChange)??{remove(){}};}
 };
}
