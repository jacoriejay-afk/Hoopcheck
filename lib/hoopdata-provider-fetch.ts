import { bdlSeasonPageUrl, parseBdlSeasonPage, type BdlLeague, type BdlFixture } from "./hoopdata-balldontlie";

type PageResult =
  | { state: "ok"; fixtures: BdlFixture[]; nextCursor: number | null }
  | { state: "budget-blocked" | "budget-unavailable" | "not-configured" | "invalid-response" }
  | { state: "provider-error"; status: number | null; retryAt: string | null };
type Dependencies = {
  reserve: (pool: "balldontlie") => Promise<boolean>;
  blockUntil: (pool: "balldontlie", retryAt: string) => Promise<void>;
  fetcher: typeof fetch;
  now: () => Date;
};

/** Use the provider's Retry-After; otherwise cool down instead of busy-looping. */
export function retryAfterTime(header: string | null, now: Date): string {
  const fallback = now.getTime() + 60_000;
  let target = fallback;
  if (header && /^[0-9]+$/.test(header.trim())) target = now.getTime() + Number(header.trim()) * 1000;
  else if (header) {
    const absolute = Date.parse(header);
    if (Number.isFinite(absolute)) target = absolute;
  }
  // Minimum cooldown; an implausibly large value stops work rather than retrying too soon.
  if (!Number.isFinite(target) || target > 8.64e15) return new Date(8.64e15).toISOString();
  return new Date(Math.max(fallback,target)).toISOString();
}

/** Fetch exactly one page, only after a durable shared-budget reservation. No implicit retries or writes. */
export async function fetchBdlSeasonPage(
  input: { league: BdlLeague; season: number; cursor?: number; apiKey?: string },
  deps: Dependencies
): Promise<PageResult> {
  if (!input.apiKey) return { state:"not-configured" };
  const url = bdlSeasonPageUrl(input.league,input.season,input.cursor);
  try {
    if (await deps.reserve("balldontlie") !== true) return { state:"budget-blocked" };
  } catch { return { state:"budget-unavailable" }; }
  const failed = async (status: number | null, header: string | null): Promise<PageResult> => {
    const retryable = status === null || status === 408 || status === 429 || status >= 500;
    if (!retryable) return { state:"provider-error", status, retryAt:null };
    const retryAt = retryAfterTime(header,deps.now());
    try { await deps.blockUntil("balldontlie",retryAt); }
    catch { return { state:"budget-unavailable" }; }
    return { state:"provider-error",status,retryAt };
  };
  let response: Response;
  try {
    response = await deps.fetcher(url,{headers:{Authorization:input.apiKey,Accept:"application/json"},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(12000)});
  } catch { return failed(null,null); }
  if (!response.ok) return failed(response.status,response.headers.get("Retry-After"));
  try {
    const page = parseBdlSeasonPage(input.league,input.season,await response.json(),input.cursor);
    return page ? {state:"ok",...page} : {state:"invalid-response"};
  } catch { return {state:"invalid-response"}; }
}
