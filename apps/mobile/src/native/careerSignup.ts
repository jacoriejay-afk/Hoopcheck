// Local, one-time navigation hint only. Never authorizes a claim or stores career data.
type Store = {getItem(key:string):Promise<string|null>;setItem(key:string,value:string):Promise<void>;removeItem(key:string):Promise<void>};
const validId=(id:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const key=(id:string)=>"hoopcheck:career-signup:v1:"+id;
const ttl=7*24*60*60*1000;
export async function rememberCareerSignup(store:Store,id:string,now=Date.now()){
 if(!validId(id))return;
 try{await store.setItem(key(id),String(now));}catch{/* Optional navigation must not block signup. */}
}
export async function consumeCareerSignup(store:Store,id:string,now=Date.now()):Promise<boolean>{
 if(!validId(id))return false;
 try{
  const raw=await store.getItem(key(id));
  if(raw===null)return false;
  await store.removeItem(key(id));
  const timestamp=Number(raw);
  return raw.trim()!==""&&Number.isFinite(timestamp)&&timestamp>0&&timestamp<=now&&now-timestamp<=ttl;
 }catch{return false;}
}
