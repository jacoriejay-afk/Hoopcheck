// Realtime callbacks carry no content. This coordinator coalesces signals,
// suppresses refresh while mutations/read requests are busy, and retries on
// the next foreground tick. Disposal prevents stale account callbacks.
export function createChatRefreshCoordinator(active:()=>boolean,busy:()=>boolean,refresh:()=>void,delay=350){
 let timer:ReturnType<typeof setTimeout>|null=null,disposed=false,pending=false;
 function request(){
  if(disposed||!active())return;
  pending=true;
  if(timer!==null)return;
  timer=setTimeout(()=>{
   timer=null;
   if(disposed||!active())return;
   if(busy())return; // keep pending; next poll or reconnect drains it.
   if(pending){pending=false;refresh();}
  },delay);
 }
 function suspend(){pending=false;if(timer!==null)clearTimeout(timer);timer=null;}
 return {request,suspend,dispose(){disposed=true;suspend();}};
}
