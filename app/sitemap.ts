import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://hoopcheck.online").replace(/\/$/, "");
export const revalidate = 3600;

type Row = { id?: string | null; username?: string | null; slug?: string | null };

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function entry(path: string, priority = 0.7): MetadataRoute.Sitemap[number] {
  return { url: new URL(path, siteUrl).toString(), changeFrequency: "weekly", priority };
}

async function getRows(table: string, columns: string): Promise<Row[]> {
  const client = publicSupabase();
  if (!client) return [];
  try {
    const { data, error } = await client.from(table).select(columns);
    if (error) {
      console.error(`Sitemap: unable to read ${table}`, error.message);
      return [];
    }
    return (data || []) as Row[];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const staticPaths = [
    entry("/", 1), entry("/directory", 0.9), entry("/teams", 0.9),
    entry("/womens", 0.8), entry("/coaches", 0.8), entry("/leagues", 0.8),
    entry("/players", 0.8), entry("/search", 0.7),
    entry("/reviews", 0.7), entry("/membership", 0.6),
    entry("/terms", 0.3), entry("/privacy", 0.3), entry("/community-guidelines", 0.3),
  ];

  const [teams, womensTeams, coaches, leagues, players] = await Promise.all([
    getRows("teams", "id"),
    getRows("womens_teams", "id"),
    getRows("coaches", "id"),
    getRows("leagues", "id"),
    getRows("profiles", "id"),
  ]);

  const profileEntries: MetadataRoute.Sitemap = [
    ...teams.filter(row => row.id).map(row => entry(`/teams/${encodeURIComponent(row.id!)}`, 0.6)),
    ...womensTeams.filter(row => row.id).map(row => entry(`/womens/${encodeURIComponent(row.id!)}`, 0.6)),
    ...coaches.filter(row => row.id).map(row => entry(`/coaches/${encodeURIComponent(row.id!)}`, 0.6)),
    ...leagues.filter(row => row.id).map(row => entry(`/leagues/${encodeURIComponent(row.id!)}`, 0.6)),
    ...players.filter(row => row.id).map(row => entry(`/players/${encodeURIComponent(row.id!)}`, 0.5)),
  ];

  return [...staticPaths, ...profileEntries].map(item => ({ ...item, lastModified }));
}
