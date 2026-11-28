import "server-only";
import {createPlayRuntimeApplication} from "./runtime-application";
import {createPlaySessionAuthorizer,createPlayProviderConflictGuard} from "./session-adapter";
import {validPlaySandbox} from "./verification";
type Options=Parameters<typeof createPlayRuntimeApplication>[0];
/** This binds the existing verified Auth/MFA and cross-provider conflict reads
 * to the isolated application. Registration remains explicitly disabled
 * until an approved private database driver and sandbox storefront exist. */
export function registerIsolatedPlayRuntime(p:Omit<Options,"authorize"|"canStartPlayBilling"|"enabled">&{reviewed?:()=>boolean}){
 const enabled=()=>p.reviewed?.()===true&&process.env.HOOPCHECK_PLAY_RUNTIME_ENABLED==="true"&&validPlaySandbox(process.env);
 return createPlayRuntimeApplication({...p,enabled,authorize:createPlaySessionAuthorizer(enabled),canStartPlayBilling:createPlayProviderConflictGuard(enabled)});
}
