import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchBdlSeasonPage } from "../../../../lib/hoopdata-provider-fetch";

export const dynamic = "force-dynamic";
export const maxDuration = 25;
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Preview-only one-page importer. No canonical writes, no scheduled invocation. */
export async function POST(request: NextRequest) {
  // Fail closed on all non-preview deployments, even if somebody sets the feature flag.
  if (process.env.VERCEL_ENV !== "preview" || process.env.HOOPDATA_PREVIEW_IMPORT_ENABLED !== "true") return reply({ error:"Disabled" },404);
  const secret = process.env.HOOPDATA_PREVIEW_CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return reply({error:"Unauthorized"},401);
  const url = process.env.HOOPDATA_ISOLATED_SUPABASE_URL, key = process.env.HOOPDATA_ISOLATED_SUPABASE_SERVICE_KEY;
  const providerKey = process.env.BALLDONTLIE_API_KEY;
  // Explicit separate database credentials only; never fall back to the application database.
  if (!url || !key || !providerKey || !process.env.NEXT_PUBLIC_SUPABASE_URL || url.replace(/\/$/,"") === process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/,"") || key === process.env.SUPABASE_SERVICE_ROLE_KEY) return reply({error:"Isolated import not configured"},503);
  let input: unknown;
  try { input = await request.json(); } catch { return reply({error:"Invalid input"},400); }
  if (!input || typeof input !== "object" || !("league" in input) || !("season" in input)) return reply({error:"Invalid input"},400);
  const league = input.league, season = input.season;
  if ((league !== "nba" && league !== "wnba") || typeof season !== "number" || !Number.isSafeInteger(season) || season < 1900 || season > 2200) return reply({error:"Invalid league or season"},400);
  const provider = league === "nba" ? "balldontlie-nba" : "balldontlie-wnba";
  try {
    const db = createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
    const {data: job,error: jobError} = await db.from("hoopdata_season_imports").select("next_cursor,completed,pages").eq("provider",provider).eq("season",season).maybeSingle();
    if (jobError) return reply({error:"Checkpoint unavailable"},503);
    if (job?.completed) return reply({state:"pagination-complete",provider,season,pages:job.pages,canonicalWrites:false,coverageCertified:false});
    const cursor: unknown = job?.next_cursor ?? null;
    if (cursor !== null && (typeof cursor !== "number" || !Number.isSafeInteger(cursor) || cursor <= 0)) return reply({error:"Invalid stored checkpoint"},503);
    const page = await fetchBdlSeasonPage({league,season,cursor:cursor ?? undefined,apiKey:providerKey},{
      fetcher:fetch,now:()=>new Date(),
      reserve:async pool=>{const {data,error}=await db.rpc("hoopdata_reserve_request",{p_pool:pool});if(error)throw Error("Quota unavailable");return data===true;},
      blockUntil:async (pool,retryAt)=>{const {data,error}=await db.rpc("hoopdata_block_provider",{p_pool:pool,p_until:retryAt});if(error||data!==true)throw Error("Cooldown unavailable");},
    });
    if (page.state !== "ok") return reply(page,page.state==="budget-blocked"?429:page.state==="budget-unavailable"?503:502);
    const {data: committed,error: commitError} = await db.rpc("hoopdata_commit_season_page",{p_provider:provider,p_season:season,p_expected:cursor,p_next:page.nextCursor,p_fixtures:page.fixtures});
    if (commitError) return reply({error:"Page commit failed"},503);
    if (committed !== true) return reply({state:"checkpoint-changed",canonicalWrites:false},409);
    return reply({state:page.nextCursor===null?"pagination-complete":"page-committed",provider,season,fixtures:page.fixtures.length,nextCursor:page.nextCursor,canonicalWrites:false,coverageCertified:false});
  } catch { return reply({error:"Isolated import unavailable"},503); }
}
