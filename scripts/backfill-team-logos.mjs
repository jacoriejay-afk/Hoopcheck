#!/usr/bin/env node
/**
 * Conservative team-crest backfill.
 *
 * Dry-run is the default. It downloads candidates only to validate source/type/dimensions
 * and prints a report; it never writes to Storage or Postgres. Production writes require
 * --apply --approved-sample AND HOOPCHECK_LOGO_BACKFILL_APPROVED=YES.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";

const APPLY = process.argv.includes("--apply");
const APPROVED_SAMPLE = process.argv.includes("--approved-sample");
const LIMIT = Math.max(1, Number(process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] || 10));
const SAMPLE = process.argv.includes("--sample");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.HOOPCHECK_TEAM_LOGO_BUCKET || "team-logos";
const MAX_BYTES = 5 * 1024 * 1024;
const MIN_DIMENSION = 64;
const HINTS_PATH = new URL("./team-logo-source-hints.json", import.meta.url);

if (!SUPABASE_URL || !(SERVICE_KEY || process.env.SUPABASE_ANON_KEY)) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or a Supabase key.");
  process.exit(1);
}
if (APPLY && !SERVICE_KEY) {
  console.error("Production writes require SUPABASE_SERVICE_ROLE_KEY; an anon/publishable key is read-only.");
  process.exit(2);
}
if (APPLY && (!APPROVED_SAMPLE || process.env.HOOPCHECK_LOGO_BACKFILL_APPROVED !== "YES")) {
  console.error("Refusing production writes. Supply --apply --approved-sample and HOOPCHECK_LOGO_BACKFILL_APPROVED=YES after reviewing the dry-run report.");
  process.exit(2);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY || process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const report = [];

function normalize(value = "") { return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
const hints = Object.fromEntries(Object.entries(JSON.parse(await fs.readFile(HINTS_PATH, "utf8"))).map(([name, url]) => [normalize(name), url]));
function tokens(value) { return normalize(value).split(/\s+/).filter((part) => part.length > 2 && !["basket","basketball","club","team","bc","the"].includes(part)); }
function resolveUrl(value, base) { try { return new URL(value, base); } catch { return null; } }
function getAttr(tag, name) { const match = tag.match(new RegExp(name + "\\s*=\\s*['\"]([^'\"]+)['\"]", "i")); return match?.[1] || ""; }
function dimensions(buffer, mime) {
  if (mime.includes("svg") || buffer.subarray(0, 200).toString("utf8").includes("<svg")) {
    const text = buffer.subarray(0, 20000).toString("utf8");
    const tag = text.match(/<svg\b[^>]*>/i)?.[0] || "";
    const w = Number(getAttr(tag, "width").replace(/[^0-9.]/g, ""));
    const h = Number(getAttr(tag, "height").replace(/[^0-9.]/g, ""));
    const view = getAttr(tag, "viewBox").split(/[ ,]+/).map(Number);
    return { width: w || view[2] || 0, height: h || view[3] || 0 };
  }
  if (buffer[0] === 0x89 && buffer.toString("ascii", 1, 4) === "PNG") return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  if (buffer.toString("ascii", 0, 3) === "GIF") return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let i = 2;
    while (i < buffer.length - 9) {
      if (buffer[i] !== 0xff) { i++; continue; }
      const marker = buffer[i + 1]; const len = buffer.readUInt16BE(i + 2);
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) return { height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7) };
      if (len < 2) break;
      i += 2 + len;
    }
  }
  return { width: 0, height: 0 };
}
async function fetchBytes(url) {
  const response = await fetch(url, { redirect: "follow", headers: { "user-agent": "HoopCheckTeamLogoBackfill/1.0 (+https://hoopcheck.online)" } });
  if (!response.ok) throw new Error("HTTP " + response.status);
  const mime = (response.headers.get("content-type") || "").split(";")[0].toLowerCase();
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 1024 || buffer.length > MAX_BYTES) throw new Error("image size outside 1KB–5MB");
  if (!mime.startsWith("image/") && !mime.includes("svg")) throw new Error("source is not an image (" + mime + ")");
  const size = dimensions(buffer, mime);
  if (size.width < MIN_DIMENSION || size.height < MIN_DIMENSION) throw new Error("image too small or dimensions could not be verified");
  return { buffer, mime, ...size, finalUrl: response.url };
}
function imageCandidates(html, pageUrl, teamName) {
  const nameTokens = tokens(teamName);
  const candidates = [];
  for (const tag of html.match(/<img\b[^>]*>/gi) || []) {
    const src = getAttr(tag, "src") || getAttr(tag, "data-src") || getAttr(tag, "data-lazy-src");
    const alt = getAttr(tag, "alt");
    const cls = getAttr(tag, "class");
    const title = getAttr(tag, "title");
    const url = resolveUrl(src, pageUrl);
    if (!url || !/^https?:$/.test(url.protocol)) continue;
    const metadata = normalize([src, alt, cls, title].join(" "));
    const logoSignal = /logo|crest|badge|emblem|coat of arms/.test(metadata);
    const matchingTokens = nameTokens.filter((token) => metadata.includes(token)).length;
    if (!logoSignal || (nameTokens.length && matchingTokens === 0)) continue;
    candidates.push({ url: url.toString(), label: [alt, title, cls].filter(Boolean).join(" ") || url.pathname, matchingTokens, pageUrl });
  }
  return candidates.sort((a,b)=>b.matchingTokens-a.matchingTokens);
}
async function findOnSite(pageUrl, teamName, sourceType) {
  const page = await fetch(pageUrl, { redirect: "follow", headers: { "user-agent": "HoopCheckTeamLogoBackfill/1.0" } });
  if (!page.ok) return null;
  const finalPageUrl = page.url;
  const html = await page.text();
  const candidates = imageCandidates(html, finalPageUrl, teamName);
  for (const candidate of candidates.slice(0, 8)) {
    try {
      const asset = await fetchBytes(candidate.url);
      return { ...asset, source: sourceType, pageUrl: finalPageUrl, candidateLabel: candidate.label };
    } catch { /* keep searching; tiny/invalid assets are intentionally ignored */ }
  }
  return null;
}
async function findOnWikimedia(teamName) {
  const q = encodeURIComponent(teamName + " basketball logo");
  const api = "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=" + q + "&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url%7Csize%7Cmime";
  const response = await fetch(api, { headers: { "user-agent": "HoopCheckTeamLogoBackfill/1.0 (https://hoopcheck.online)" } });
  if (!response.ok) return null;
  const payload = await response.json();
  const pages = Object.values(payload?.query?.pages || {});
  const expected = normalize(teamName);
  for (const page of pages) {
    const title = normalize(page.title || "");
    const overlap = tokens(teamName).filter((token) => title.includes(token)).length;
    if (!title.includes(expected) && overlap < Math.min(2, tokens(teamName).length)) continue;
    const info = page.imageinfo?.[0];
    if (!info?.url || info.width < MIN_DIMENSION || info.height < MIN_DIMENSION) continue;
    try {
      const asset = await fetchBytes(info.url);
      return { ...asset, source: "Wikimedia Commons", pageUrl: "https://commons.wikimedia.org/wiki/" + encodeURIComponent(page.title), candidateLabel: page.title };
    } catch { /* invalid/tiny image: skip */ }
  }
  return null;
}
async function getRows(table) {
  let query = supabase.from(table).select("id,name,country,city,league_id,league_name,logo_url" + (table === "teams" ? ",website" : "")).is("logo_url", null).order("name").limit(LIMIT);
  const { data, error } = await query;
  if (error) throw new Error(table + ": " + error.message);
  return (data || []).map((row) => ({ ...row, __table: table }));
}
async function main() {
  const tables = SAMPLE ? ["teams"] : ["teams", "womens_teams"];
  const rows = [];
  for (const table of tables) rows.push(...await getRows(table));
  const chosen = rows.slice(0, LIMIT);
  for (const row of chosen) {
    const key = normalize(row.name);
    let candidate = null;
    const sources = [];
    const officialUrl = row.website || hints[key];
    if (officialUrl) {
      sources.push({ url: officialUrl, type: "Official team site" });
      try { candidate = await findOnSite(officialUrl, row.name, "Official team site"); } catch { /* skip this source */ }
    }
    if (!candidate && row.league_id) {
      try {
        const { data: league } = await supabase.from("leagues").select("id,name,website").eq("id", row.league_id).maybeSingle();
        if (league?.website) {
          sources.push({ url: league.website, type: "Official league site" });
          candidate = await findOnSite(league.website, row.name, "Official league site");
        }
      } catch { /* website field may not exist; never treat this as a candidate */ }
    }
    if (!candidate) {
      try { candidate = await findOnWikimedia(row.name); } catch { /* fail closed */ }
    }
    if (!candidate) {
      report.push({ table: row.__table, team: row.name, source: sources.map((s)=>s.type).join(" → ") || "Wikimedia Commons", status: "SKIP", reason: "No confident logo match with verified image dimensions" });
      continue;
    }
    const extension = candidate.mime.includes("svg") ? "svg" : candidate.mime.includes("png") ? "png" : candidate.mime.includes("gif") ? "gif" : "jpg";
    const sourceLabel = candidate.source + " — " + candidate.pageUrl;
    if (!APPLY) {
      report.push({ table: row.__table, team: row.name, source: sourceLabel, status: "READY (dry-run)", dimensions: candidate.width + "×" + candidate.height, bytes: candidate.buffer.length, reason: "Validated candidate; no upload or database write performed" });
      continue;
    }
    const objectPath = row.__table + "/" + row.id + "." + extension;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(objectPath, candidate.buffer, { contentType: candidate.mime, upsert: false, cacheControl: "31536000" });
    if (uploadError) {
      report.push({ table: row.__table, team: row.name, source: sourceLabel, status: "SKIP", reason: "Storage upload failed: " + uploadError.message });
      continue;
    }
    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
    const { error: updateError } = await supabase.from(row.__table).update({ logo_url: publicData.publicUrl }).eq("id", row.id).is("logo_url", null);
    if (updateError) {
      report.push({ table: row.__table, team: row.name, source: sourceLabel, status: "ERROR", reason: "Uploaded but database update failed; object path: " + objectPath + "; " + updateError.message });
      continue;
    }
    report.push({ table: row.__table, team: row.name, source: sourceLabel, status: "SUCCESS", dimensions: candidate.width + "×" + candidate.height, storedUrl: publicData.publicUrl });
  }
  console.log(JSON.stringify({ mode: APPLY ? "APPLY" : "DRY RUN", writesEnabled: APPLY, report }, null, 2));
}
main().catch((error) => { console.error(error); process.exit(1); });
