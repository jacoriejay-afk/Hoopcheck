import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const required = ["claimant_name","claimant_email","copyrighted_work_description","infringing_content_url","infringement_description","good_faith_statement","accuracy_statement","electronic_signature"];
  for (const field of required) if (typeof body[field] !== "string" || !body[field].trim()) return NextResponse.json({error:`${field} is required.`},{status:400});
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json({error:"Copyright reporting is temporarily unavailable."},{status:503});
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
  const {error}=await db.from("copyright_reports").insert({
    report_type: body.report_type === "counter_notice" ? "counter_notice" : "dmca_notice", status:"received",
    claimant_name:body.claimant_name.trim().slice(0,200), claimant_email:body.claimant_email.trim().slice(0,320), claimant_address:body.claimant_address?.trim().slice(0,1000)||null, claimant_phone:body.claimant_phone?.trim().slice(0,80)||null,
    copyrighted_work_description:body.copyrighted_work_description.trim().slice(0,5000), original_work_url:body.original_work_url?.trim().slice(0,2000)||null, infringing_content_url:body.infringing_content_url.trim().slice(0,2000), infringement_description:body.infringement_description.trim().slice(0,5000), good_faith_statement:body.good_faith_statement.trim().slice(0,2000), accuracy_statement:body.accuracy_statement.trim().slice(0,2000), electronic_signature:body.electronic_signature.trim().slice(0,200), counter_notice_basis:body.counter_notice_basis?.trim().slice(0,5000)||null, counter_notice_statement:body.counter_notice_statement?.trim().slice(0,5000)||null
  });
  if(error) return NextResponse.json({error:"We could not record the report. Please contact Support."},{status:500});
  return NextResponse.json({ok:true});
}