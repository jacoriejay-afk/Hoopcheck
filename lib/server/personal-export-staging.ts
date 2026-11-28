// Server-only private staging for a reviewed disclosure plan. This is not a
// data-source inventory, public download route, storage policy, or fulfillment
// acknowledgement. Callers must bind the plan to an approved privacy request,
// use caller-authorized projections, and supply the approved expiry.
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { chmod, link, lstat, mkdtemp, open, readdir, rm, unlink } from "node:fs/promises";
import { join } from "node:path";

type Scalar = string|number|boolean|null;
type SectionPlan={name:string;fields:readonly string[]};
export type PersonalExportPlan={
 requestId:string;ownerId:string;policyVersion:string;expiresAt:string;
 byteLimit:number;sections:readonly SectionPlan[];
};
type ExportRow={id:string;ownerId:string;data:Record<string,unknown>};
type Page={rows:readonly ExportRow[];hasMore:boolean};
type Reader=(input:{ownerId:string;after:string|null;limit:number;signal:AbortSignal})=>Promise<Page>;
type ReaderMap=Readonly<Record<string,Reader>>;
type Authorize=(plan:Readonly<PersonalExportPlan>,signal:AbortSignal)=>Promise<boolean>;
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const rowId=/^[a-z0-9_-]{1,128}$/;
const fieldName=/^[a-z][a-z0-9_]{0,63}$/;
const deniedField=/(?:^|_)(?:password|secret|token|credential|private_key|api_key|refresh|session|card|payment_method|stripe|internal|admin|moderation|reviewer|author_id|sender_id|recipient_id|owner_id|user_id)(?:_|$)/;
const sectionNames=new Set(["account","profile","career","passport","reviews","feed_posts","feed_comments","feed_replies","stories","messages","groups","notifications","saved","billing","privacy_requests","preferences","other"]);
function planSnapshot(plan:PersonalExportPlan){
 if(!uuid.test(plan.requestId)||!uuid.test(plan.ownerId)||typeof plan.policyVersion!=="string"||!plan.policyVersion.trim()||plan.policyVersion.length>100||
  typeof plan.expiresAt!=="string"||!Number.isFinite(Date.parse(plan.expiresAt))||Date.parse(plan.expiresAt)<=Date.now()||
  !Number.isSafeInteger(plan.byteLimit)||plan.byteLimit<1||plan.byteLimit>512*1024*1024||
  !Array.isArray(plan.sections)||!plan.sections.length||plan.sections.length>sectionNames.size)throw Error("Invalid approved export plan.");
 const names=new Set<string>();
 const sections=plan.sections.map(s=>{
  if(!s||!sectionNames.has(s.name)||names.has(s.name)||!Array.isArray(s.fields)||!s.fields.length||s.fields.length>64)throw Error("Invalid export section.");
  names.add(s.name);
  const fields=Array.from(s.fields) as string[];
  if(new Set(fields).size!==fields.length||fields.some(f=>typeof f!=="string"||!fieldName.test(f)||deniedField.test(f)))throw Error("Invalid export projection.");
  return Object.freeze({name:s.name,fields:Object.freeze(fields)});
 });
 return Object.freeze({requestId:plan.requestId,ownerId:plan.ownerId,policyVersion:plan.policyVersion,expiresAt:plan.expiresAt,byteLimit:plan.byteLimit,sections:Object.freeze(sections)});
}
function project(row:ExportRow,section:SectionPlan,owner:string,previous:string|null){
 if(!row||row.ownerId!==owner||typeof row.id!=="string"||!rowId.test(row.id)||(previous!==null&&row.id<=previous)||!row.data||typeof row.data!=="object"||Array.isArray(row.data))throw Error("Export row scope invalid.");
 const output:Record<string,Scalar>=Object.create(null);
 for(const field of section.fields){
  const descriptor=Object.getOwnPropertyDescriptor(row.data,field);
  const value=descriptor?.value;
  if(!descriptor||!("value" in descriptor)||!(value===null||typeof value==="boolean"||typeof value==="number"&&Number.isFinite(value)||typeof value==="string"&&value.length<=65536))throw Error("Invalid export value.");
  output[field]=value as Scalar;
 }
 return output;
}
/** Creates an unpublished, 0600 NDJSON file with bounded page and row memory.
 * Only the internal returned capability can read or dispose it. The caller
 * must still implement durable private storage, request completion and cleanup
 * scheduling before any hosted use. No expiry duration is chosen here. */
export async function stagePersonalExport(input:PersonalExportPlan,readers:ReaderMap,authorize:Authorize,privateRoot:string,signal:AbortSignal){
 const plan=planSnapshot(input);
 const registry=new Map(plan.sections.map(section=>[section.name,readers[section.name]]));
 if([...registry.values()].some(reader=>typeof reader!=="function"))throw Error("Approved export source unavailable.");
 async function boundary(check:AbortSignal){
  if(check.aborted||Date.parse(plan.expiresAt)<=Date.now()||await authorize(plan,check)!==true||check.aborted||Date.parse(plan.expiresAt)<=Date.now())throw Error("Export authorization unavailable.");
 }
 await boundary(signal);
 const directory=await mkdtemp(join(privateRoot,"hoopcheck-export-"));
 const path=join(directory,"export.ndjson");
 let file:Awaited<ReturnType<typeof open>>|null=null;
 let closed=false,bytes=0,rows=0;
 const digest=createHash("sha256");
 try{
  await chmod(directory,0o700);
  file=await open(path,"wx",0o600);
  const output=file;
  async function append(value:unknown){
   if(signal.aborted)throw Error("Export cancelled.");
   const line=Buffer.from(JSON.stringify(value)+"\n","utf8");
   if(line.length>256*1024||bytes+line.length>plan.byteLimit)throw Error("Export exceeds approved technical budget.");
   await output.writeFile(line);
   digest.update(line);bytes+=line.length;
  }
  await append({format:"hoopcheck-personal-data-ndjson-v1",policyVersion:plan.policyVersion,expiresAt:plan.expiresAt,sections:plan.sections.map(s=>s.name)});
  for(const section of plan.sections){
   const reader=registry.get(section.name)!;
   let after:string|null=null;
   for(;;){
    await boundary(signal);
    const page=await reader({ownerId:plan.ownerId,after,limit:100,signal});
    await boundary(signal);
    if(!page||!Array.isArray(page.rows)||page.rows.length>100||typeof page.hasMore!=="boolean"||(page.hasMore&&!page.rows.length))throw Error("Invalid export page.");
    for(const row of page.rows){
     const data=project(row,section,plan.ownerId,after);
     await append({section:section.name,id:row.id,data});
     after=row.id;rows++;
    }
    if(!page.hasMore)break;
   }
  }
  await append({end:true,rows});
  await boundary(signal);
  await output.sync();await output.close();file=null;
  await boundary(signal);
  const sha256=digest.digest("hex");
  async function dispose(){if(!closed){closed=true;await rm(directory,{recursive:true,force:true});}}
  // Never accept an arbitrary filesystem path or hand it to the browser.
  // Bind retrieval to the exact request and owner, check expiry and re-check
  // the approved authorization at every bounded chunk.
  async function* read(ownerId:string,requestId:string,downloadSignal:AbortSignal):AsyncGenerator<Buffer>{
   if(closed||ownerId!==plan.ownerId||requestId!==plan.requestId)throw Error("Export unavailable.");
   await boundary(downloadSignal);
   const reader=await open(path,"r");
   try{
    if((await reader.stat()).size!==bytes)throw Error("Export artifact changed.");
    let position=0;
    while(position<bytes){
     if(closed)throw Error("Export unavailable.");
     await boundary(downloadSignal);
     const buffer=Buffer.alloc(Math.min(65536,bytes-position));
     const result=await reader.read(buffer,0,buffer.length,position);
     if(result.bytesRead<1)throw Error("Export artifact incomplete.");
     await boundary(downloadSignal);
     if(closed)throw Error("Export unavailable.");
     position+=result.bytesRead;
     yield buffer.subarray(0,result.bytesRead);
    }
   }finally{await reader.close();}
  }
  return Object.freeze({rows,bytes,sha256,expiresAt:plan.expiresAt,read,dispose});
 }catch{
  if(file)await file.close().catch(()=>{});
  await rm(directory,{recursive:true,force:true}).catch(()=>{});
  // Do not expose private source rows, paths, identifiers or provider errors.
  throw Error("Personal export staging could not be confirmed.");
 }
}

type Receipt = { rows: number; bytes: number; sha256: string };
type Scope = { plan: PersonalExportPlan; name: string; path: string; expires: number; fingerprint: string };
const headerSize = 512;
const chunkSize = 65536;
const unavailable = () => Error("Personal export unavailable.");

function isMissing(error: unknown) {
  return (error as NodeJS.ErrnoException | null)?.code === "ENOENT";
}

/** Worker and download adapters for an approved private, persistent volume.
 * The caller supplies the approved plan and a live authorization check.
 * Each request publishes one immutable file via a same-volume atomic link. */
export function createPersonalExportArtifacts(privateRoot: string, authorize: Authorize, now = Date.now) {
  async function scope(input: PersonalExportPlan): Promise<Scope> {
    const plan = structuredClone(input);
    const dir = await lstat(privateRoot);
    if (!dir.isDirectory() || (dir.mode & 0o077) !== 0 || !uuid.test(plan.ownerId) || !uuid.test(plan.requestId)) throw unavailable();
    const expires = Date.parse(plan.expiresAt);
    if (!Number.isFinite(expires)) throw unavailable();
    const name = `${plan.ownerId}.${plan.requestId}`;
    const fingerprint = createHash("sha256")
      .update(JSON.stringify([plan.policyVersion, plan.expiresAt, plan.byteLimit, plan.sections.map(section => [section.name, section.fields])]))
      .digest("hex");
    return { plan, expires, name, path: join(privateRoot, name), fingerprint };
  }

  async function verify(entry: Scope, signal: AbortSignal) {
    if (signal.aborted || now() >= entry.expires || await authorize(entry.plan, signal) !== true ||
      signal.aborted || now() >= entry.expires) throw unavailable();
  }

  async function readHeader(file: Awaited<ReturnType<typeof open>>, entry: Scope): Promise<Receipt> {
    const stat = await file.stat();
    const header = Buffer.alloc(headerSize);
    const result = await file.read(header, 0, header.length, 0);
    if (!stat.isFile() || (stat.mode & 0o077) !== 0 || result.bytesRead !== header.length) throw unavailable();
    const row = JSON.parse(header.toString("utf8"));
    const { rows, bytes, sha256 } = row;
    if (row.version !== 1 || row.fingerprint !== entry.fingerprint || !Number.isSafeInteger(rows) || rows < 0 ||
      !Number.isSafeInteger(bytes) || bytes < 1 || bytes > entry.plan.byteLimit || bytes + headerSize !== stat.size ||
      typeof sha256 !== "string" || !/^[0-9a-f]{64}$/.test(sha256)) throw unavailable();
    return { rows, bytes, sha256 };
  }

  async function inspect(entry: Scope) {
    let file;
    try { file = await open(entry.path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); }
    catch (error) { if (isMissing(error)) return null; throw error; }
    try { return await readHeader(file, entry); }
    finally { await file.close(); }
  }

  async function syncDirectory() {
    const root = await open(privateRoot, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try { await root.sync(); }
    finally { await root.close(); }
  }

  return {
    async generate(input: PersonalExportPlan, readers: ReaderMap, signal: AbortSignal): Promise<Receipt> {
      try {
        const entry = await scope(input);
        await verify(entry, signal);
        const existing = await inspect(entry);
        if (existing) {
          await syncDirectory();
          await verify(entry, signal);
          return existing;
        }
        const work = await mkdtemp(join(privateRoot, `.${entry.name}.`));
        try {
          const staged = await stagePersonalExport(entry.plan, readers, authorize, work, signal);
          const temporary = join(work, "artifact");
          const file = await open(temporary, "wx", 0o600);
          try {
            const header = Buffer.alloc(headerSize, " ");
            const { rows, bytes, sha256 } = staged;
            const encoded = Buffer.from(JSON.stringify({ version: 1, fingerprint: entry.fingerprint, rows, bytes, sha256 }));
            if (encoded.length > header.length) throw unavailable();
            encoded.copy(header);
            await file.writeFile(header);
            const digest = createHash("sha256");
            let written = 0;
            for await (const chunk of staged.read(entry.plan.ownerId, entry.plan.requestId, signal)) {
              digest.update(chunk);
              written += chunk.length;
              await file.writeFile(chunk);
            }
            if (written !== bytes || digest.digest("hex") !== sha256) throw unavailable();
            await file.sync();
          } finally { await file.close(); }
          await verify(entry, signal);
          try { await link(temporary, entry.path); }
          catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
          await syncDirectory();
          const receipt = await inspect(entry);
          await verify(entry, signal);
          if (!receipt) throw unavailable();
          return receipt;
        } finally { await rm(work, { recursive: true, force: true }); }
      } catch { throw unavailable(); }
    },

    async *read(input: PersonalExportPlan, authenticatedOwner: string, signal: AbortSignal): AsyncGenerator<Buffer> {
      try {
        if (authenticatedOwner !== input.ownerId) throw unavailable();
        const entry = await scope(input);
        await verify(entry, signal);
        const file = await open(entry.path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        try {
          const receipt = await readHeader(file, entry);
          for (let offset = 0; offset < receipt.bytes;) {
            await verify(entry, signal);
            const chunk = Buffer.alloc(Math.min(chunkSize, receipt.bytes - offset));
            const { bytesRead } = await file.read(chunk, 0, chunk.length, offset + headerSize);
            if (bytesRead === 0) throw unavailable();
            await verify(entry, signal);
            offset += bytesRead;
            yield chunk.subarray(0, bytesRead);
          }
        } finally { await file.close(); }
      } catch { throw unavailable(); }
    },

    /** Invoke only from the approved request registry with its recorded plan. */
    async expire(input: PersonalExportPlan, signal: AbortSignal) {
      try {
        const entry = await scope(input);
        if (signal.aborted || now() < entry.expires) return false;
        const receipt = await inspect(entry);
        if (receipt) {
          if (signal.aborted) return false;
          await unlink(entry.path).catch(error => { if (!isMissing(error)) throw error; });
        }
        const prefix = `.${entry.name}.`;
        for (const name of await readdir(privateRoot)) {
          if (signal.aborted) return false;
          if (name.startsWith(prefix) && /^[a-zA-Z0-9]{6}$/.test(name.slice(prefix.length))) {
            await rm(join(privateRoot, name), { recursive: true, force: true });
          }
        }
        await syncDirectory();
        return true;
      } catch { throw unavailable(); }
    },
  };
}
