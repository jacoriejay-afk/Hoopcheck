import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import { SITE_URL } from "./site-url";

const siteUrl = SITE_URL;
const defaultDescription = "Real reviews of basketball teams, coaches, leagues and agents, written by players. Check the team before you sign.";

type EntityType = "team" | "coach" | "league" | "player" | "agent" | "womens_team";
type EntityRow = Record<string, unknown> & { id?: string; name?: string; username?: string; city?: string | null; country?: string | null };

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const config: Record<EntityType, { table: string; label: string; summaryType: string }> = {
  team: { table: "teams", label: "Team", summaryType: "team" },
  coach: { table: "coaches", label: "Coach", summaryType: "coach" },
  league: { table: "leagues", label: "League", summaryType: "league" },
  player: { table: "profiles", label: "Player", summaryType: "player" },
  agent: { table: "agents", label: "Agent", summaryType: "agent" },
  womens_team: { table: "womens_teams", label: "Team", summaryType: "team" },
};

export type SeoProfile = {
  name: string;
  location: string;
  leagueName?: string;
  leagueId?: string;
  rating: number | null;
  reviewCount: number;
  canonical: string;
  jsonLd?: Record<string, unknown>;
};

export async function getProfileSeo(type: EntityType, id: string): Promise<SeoProfile | null> {
  const client = db();
  if (!client || !id) return null;
  const cfg = config[type];
  const isTeam = type === "team" || type === "womens_team";
  const { data, error } = isTeam
    ? await client.from(cfg.table).select("id,name,city,country,league_name,league_id").eq("id", id).maybeSingle()
    : type === "player"
      ? await client.from(cfg.table).select("*").eq("id", id).eq("account_type", "player").eq("profile_visibility", "public").eq("moderation_status", "normal").maybeSingle()
      : await client.from(cfg.table).select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  const row = data as EntityRow;
  const name = String(row.name || row.display_name || row.full_name || row.username || id);
  const location = [row.city, row.country].filter((value): value is string => typeof value === "string" && Boolean(value.trim())).join(", ");
  let rating: number | null = null;
  let reviewCount = 0;
  try {
    const { data: summary } = await client.rpc("get_public_review_summary", {
      p_entity_type: cfg.summaryType,
      p_entity_id: String(row.id || id),
    });
    const item = Array.isArray(summary) ? summary[0] : summary;
    if (item) {
      const rawRating = item.overall_rating ?? item.average_rating;
      const rawCount = item.review_count ?? item.total_reviews;
      rating = rawRating == null || !Number.isFinite(Number(rawRating)) ? null : Number(rawRating);
      reviewCount = Number.isFinite(Number(rawCount)) ? Math.max(0, Number(rawCount)) : 0;
    }
  } catch {
    // Keep metadata factual when the public summary is unavailable.
  }

  const pathname = type === "womens_team" ? "/womens" : type === "team" ? "/teams" : type === "player" ? "/players" : `/${type === "agent" ? "agents" : type + "s"}`;
  const canonical = new URL(`${pathname}/${encodeURIComponent(type === "player" ? String(row.id || id) : String(row.id || id))}`, siteUrl).toString();
  const facts = [
    rating !== null ? `Average rating: ${rating.toFixed(1)}/5` : null,
    `${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}`,
    location || null,
  ].filter(Boolean);
  const description = `${name} ${cfg.label.toLowerCase()} reviews on HoopCheck. ${facts.join(" · ")}. Read player experiences and research before making your next basketball decision.`;

  const jsonLd = type === "team" && reviewCount > 0 && rating !== null ? {
    "@context": "https://schema.org",
    "@type": "SportsTeam",
    name,
    url: canonical,
    ...(location ? { location: { "@type": "Place", name: location } } : {}),
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: Number(rating.toFixed(2)),
      reviewCount,
      bestRating: 5,
      worstRating: 1,
    },
  } : undefined;

  const leagueName = isTeam && typeof row.league_name === "string" ? row.league_name.trim() : undefined;
  const leagueId = isTeam && typeof row.league_id === "string" ? row.league_id : undefined;
  return { name, location, leagueName, leagueId, rating, reviewCount, canonical, jsonLd };
}

export function profileMetadata(profile: SeoProfile | null, fallbackPath: string): Metadata {
  if (!profile) {
    return { ...(fallbackPath.startsWith("/players/") ? { robots: { index: false, follow: true } } : {}), alternates: { canonical: new URL(fallbackPath, siteUrl).toString() } };
  }
  const title = `${profile.name} Reviews`;
  return {
    title,
    description: `${profile.name} reviews on HoopCheck. ${profile.rating !== null ? `Average rating ${profile.rating.toFixed(1)}/5. ` : ""}${profile.reviewCount} ${profile.reviewCount === 1 ? "review" : "reviews"}.${profile.location ? ` Location: ${profile.location}.` : ""} Check the team before you sign.`,
    alternates: { canonical: profile.canonical },
    openGraph: { type: "website", title: `${title} | HoopCheck`, url: profile.canonical, images: ["/hoopcheck-logo.svg"] },
    twitter: { card: "summary_large_image", title: `${title} | HoopCheck`, images: ["/hoopcheck-logo.svg"] },
  };
}

export { siteUrl, defaultDescription };
