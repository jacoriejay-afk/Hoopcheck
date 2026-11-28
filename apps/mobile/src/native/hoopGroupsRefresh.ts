// Realtime events are invalidation hints, never trusted message payloads.
// Coalesce bursts and discard pending work when the caller/channel loses scope.
export function createGroupRefreshQueue(active:()=>boolean, refresh:()=>void, delay=500) {
  let timer: ReturnType<typeof setTimeout>|null=null;
  let stopped=false;
  function request(){
    if(stopped||timer!==null||!active())return;
    timer=setTimeout(()=>{
      timer=null;
      if(!stopped&&active())refresh();
    },delay);
  }
  function cancel(){if(timer!==null)clearTimeout(timer);timer=null;}
  return {request,cancel,dispose(){stopped=true;cancel();}};
}
