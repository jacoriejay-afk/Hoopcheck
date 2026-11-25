import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ManagerGameSubmissions from "../../../components/ManagerGameSubmissions";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Game submissions | HoopCheck™ Team HQ",robots:{index:false,follow:false}};
export default async function GameSubmissionsPage({searchParams}:{searchParams:Promise<{teamId?:string|string[]}>}){
 if(process.env.VERCEL_ENV!=="preview"||process.env.HOOPDATA_MANAGER_PREVIEW_ENABLED!=="true")notFound();
 const isolated=process.env.HOOPDATA_ISOLATED_SUPABASE_URL,production=process.env.HOOPDATA_PRODUCTION_SUPABASE_URL,app=process.env.NEXT_PUBLIC_SUPABASE_URL,isolatedKey=process.env.HOOPDATA_ISOLATED_SUPABASE_PUBLISHABLE_KEY,appKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 let valid=false;
 try{
  if(isolated&&production&&app&&isolatedKey&&appKey&&isolatedKey===appKey){
   const i=new URL(isolated),p=new URL(production),a=new URL(app);
   valid=i.protocol==="https:"&&p.protocol==="https:"&&i.origin===a.origin&&i.origin!==p.origin&&i.pathname==="/"&&a.pathname==="/"&&!i.username&&!i.password&&!i.search&&!i.hash&&!a.username&&!a.password&&!a.search&&!a.hash&&isolatedKey!==process.env.SUPABASE_SERVICE_ROLE_KEY&&isolatedKey!==process.env.HOOPDATA_ISOLATED_SUPABASE_SERVICE_KEY;
  }
 }catch{/* fail closed */}
 if(!valid)notFound();
 const teamId=(await searchParams).teamId;
 if(typeof teamId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId))notFound();
 return <main className="page-shell"><div className="page-container"><header className="hero-card"><p>Team HQ · Isolated preview</p><h1>Submit game information</h1><p>Verified team representatives can submit fixtures and results for independent review. Suggestions never change official scores automatically.</p><Link href="/team-dashboard" prefetch={false}>Back to Team HQ</Link></header><ManagerGameSubmissions key={teamId} teamId={teamId.toLowerCase()}/></div></main>;
}
