import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { SITE_URL } from "../lib/site-url";

const siteUrl = SITE_URL;
export const revalidate = 3600;

type Row = { id?: string | null; profile_visibility?: string | null; moderation_status?: string | null };

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function entry(path: string, priority = 0.7): MetadataRoute.Sitemap[number] {
  return { url: new URL(path, siteUrl).toString(), changeFrequency: "weekly", priority };
}

/** Read every matching row in pages so the Supabase default row limit cannot truncate the sitemap. */
async function getRows(table: string, columns: string, configure?: (query: any) => any): Promise<Row[]> {
  const client = publicSupabase();
  if (!client) return [];
  const rows: Row[] = [];
  const pageSize = 500;
  try {
    for (let from = 0; ; from += pageSize) {
      let query: any = client.from(table).select(columns);
      if (configure) query = configure(query);
      const { data, error } = await query.range(from, from + pageSize - 1);
      if (error) {
        console.error(`Sitemap: unable to read ${table}`, error.message);
        return rows;
      }
      const page = (data || []) as Row[];
      rows.push(...page);
      if (page.length < pageSize) break;
    }
  } catch (error) {
    console.error(`Sitemap: unexpected read failure for ${table}`, error);
  }
  return rows;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const staticPaths = [
    { ...entry("/", 1), changeFrequency: "weekly" as const },
    entry("/directory", 0.9), entry("/teams", 0.9), entry("/womens", 0.9),
    entry("/coaches", 0.9), entry("/leagues", 0.9), entry("/players", 0.9),
    entry("/search", 0.7), entry("/reviews", 0.7), entry("/membership", 0.6),
    entry("/terms", 0.3), entry("/privacy", 0.3), entry("/community-guidelines", 0.3),
  ];

  const [teams, womensTeams, coaches, leagues, players] = await Promise.all([
    getRows("teams", "id"),
    getRows("womens_teams", "id"),
    getRows("coaches", "id"),
    getRows("leagues", "id"),
    // Only list public, normally moderated player profiles; private profiles must not be exposed by the sitemap.
    getRows("profiles", "id,profile_visibility,moderation_status", query =>
      query.eq("account_type", "player").eq("profile_visibility", "public").eq("moderation_status", "normal")
    ),
  ]);

  const profileEntries: MetadataRoute.Sitemap = [
    ...teams.filter(row => row.id).map(row => entry(`/teams/${encodeURIComponent(row.id!)}`, 0.7)),
    ...womensTeams.filter(row => row.id).map(row => entry(`/womens/${encodeURIComponent(row.id!)}`, 0.7)),
    ...coaches.filter(row => row.id).map(row => entry(`/coaches/${encodeURIComponent(row.id!)}`, 0.7)),
    ...leagues.filter(row => row.id).map(row => entry(`/leagues/${encodeURIComponent(row.id!)}`, 0.7)),
    ...players.filter(row => row.id).map(row => entry(`/players/${encodeURIComponent(row.id!)}`, 0.7)),
  ];

  // The web app currently has no individual agent-profile route, so agent URLs are
  // intentionally omitted rather than generating sitemap links that resolve to 404s.
  const allEntries = [...staticPaths, ...profileEntries];
  const uniqueEntries = Array.from(new Map(allEntries.map(item => [item.url, item])).values());
  return uniqueEntries.map(item => ({ ...item, lastModified }));
}
