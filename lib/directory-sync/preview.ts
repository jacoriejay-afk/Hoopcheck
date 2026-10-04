import type { NormalizedDirectory, SyncEntityType } from "./types";
import { clean, normalizedKey } from "./sync-record";

export type PreviewChange={entityType:SyncEntityType;action:"create"|"update"|"skip";name:string;country:string|null;externalId:string|null;reason:string};

export function buildPreview(entityType:SyncEntityType,directory:NormalizedDirectory){
 const rows:any[]=directory[entityType];
 return rows.map((r):PreviewChange=>{
  const name=clean(r.name);
  if(!name)return {entityType,action:"skip",name:"",country:null,externalId:clean(r.externalId),reason:"Missing name"};
  return {entityType,action:"create",name,country:clean(r.country),externalId:clean(r.externalId),reason:"New normalized provider record; database match is resolved during preview."};
 });
}
