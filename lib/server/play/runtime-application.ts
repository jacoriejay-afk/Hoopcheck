import "server-only";
import {createDisposablePlayAdapters} from "./disposable-adapters";
import {createDisposablePlayRuntime} from "./disposable-runtime";
import {createDisposablePlayHandler} from "./disposable-handler";
import {createPlayCatalogAdapter} from "./catalog-adapter";
import {createPlayNotificationRuntime} from "./notification-runtime";
type RuntimeOptions=Parameters<typeof createDisposablePlayRuntime>[0];
type CatalogOptions=Parameters<typeof createPlayCatalogAdapter>[0];
type RepositoryOptions=Parameters<typeof createDisposablePlayAdapters>[0];
type NotificationOptions=Parameters<typeof createPlayNotificationRuntime>[0];
type Session=NonNullable<Awaited<ReturnType<RuntimeOptions["authorize"]>>>;
/** Registration boundary. Only a private, explicitly approved disposable
 * repository and simulated acknowledgment adapter may be supplied. No
 * production or hosted database connection is constructed in this module. */
export function createPlayRuntimeApplication(p:{
 scope:"disposable_pg17";origin:string;enabled?:()=>boolean;repository:RepositoryOptions;
 authorize:RuntimeOptions["authorize"];approvedRegion:CatalogOptions["approvedRegion"];
 canStartPlayBilling:(request:Request,session:Session)=>Promise<boolean>;
 provider:RuntimeOptions["provider"];vault:RuntimeOptions["vault"];
 simulateAcknowledgment:RuntimeOptions["simulateAcknowledgment"];now:()=>number;
 notification:Pick<NotificationOptions,"config"|"keyRequest">;
}){
 if(p.scope!=="disposable_pg17"||p.repository.scope!=="disposable_pg17")throw Error("Disposable repository required");
 const enabled=()=>p.enabled?.()===true&&p.repository.enabled();
 const db=createDisposablePlayAdapters({...p.repository,enabled});
 const createRuntime=(request?:Request)=>createDisposablePlayRuntime({scope:p.scope,enabled,authorize:p.authorize,db,vault:p.vault,provider:p.provider,now:p.now,simulateAcknowledgment:p.simulateAcknowledgment,
  catalog:createPlayCatalogAdapter({enabled,provider:p.provider,approvedRegion:p.approvedRegion,canStartPlayBilling:s=>request?p.canStartPlayBilling(request,s):Promise.resolve(false)})});
 const worker=createPlayNotificationRuntime({scope:p.scope,enabled,db,runtime:createRuntime(),vault:p.vault,now:p.now,...p.notification});
 return {db,
  POST:async(request:Request)=>enabled()?createDisposablePlayHandler(createRuntime(request),p.scope,p.origin)(request):new Response(null,{status:503,headers:{"Cache-Control":"no-store"}}),
  notificationPOST:worker.POST,tick:worker.tick
 };
}
