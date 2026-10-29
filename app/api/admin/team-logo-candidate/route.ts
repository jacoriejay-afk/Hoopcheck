import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function safeHttpsUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Only public HTTPS source URLs are supported.");
  const host = url.hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || /^\d+(\.\d+){3}$/.test(host) || host.startsWith("[") || host === "metadata.google.internal") {
    throw new Error("That host is not allowed.");
  }
  return url;
}

function getMetaImage(html: string, pageUrl: URL): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const links = html.match(/<link\b[^>]*>/gi) || [];
  const getAttr = (tag: string, name: string) => {
    const match = tag.match(new RegExp("\\b" + name + "\\s*=\\s*(['\"])(.*?)\\1", "i"));
    return match?.[2] || "";
  };
  for (const tag of tags) {
    const key = (getAttr(tag, "property") || getAttr(tag, "name")).toLowerCase();
    if (["og:image", "og:image:url", "twitter:image"].includes(key)) {
      const value = getAttr(tag, "content");
      if (value) return new URL(value, pageUrl).toString();
    }
  }
  for (const tag of links) {
    const rel = getAttr(tag, "rel").toLowerCase().split(/\s+/);
    if (rel.includes("apple-touch-icon") || rel.includes("icon")) {
      const value = getAttr(tag, "href");
      if (value) return new URL(value, pageUrl).toString();
    }
  }
  return null;
}

async function readLimited(response: Response): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_BYTES) throw new Error("Candidate image is larger than 5 MB.");
  if (!response.body) throw new Error("Candidate image has no body.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BYTES) { await reader.cancel(); throw new Error("Candidate image is larger than 5 MB."); }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length; }
  return all;
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key || !token) return NextResponse.json({ error: "Admin session is required." }, { status: 401 });
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: "Bearer " + token } } });
    const { data: userData, error: userError } = await client.auth.getUser(token);
    if (userError || !userData.user) return NextResponse.json({ error: "Admin session is invalid." }, { status: 401 });
    const { data: isAdmin, error: roleError } = await client.rpc("is_current_user_admin_or_moderator");
    if (roleError || !isAdmin) return NextResponse.json({ error: "Admin or moderator access is required." }, { status: 403 });

    const body = await request.json();
    if (typeof body.sourceUrl !== "string" || body.sourceUrl.length > 2048) return NextResponse.json({ error: "Enter a valid source page URL." }, { status: 400 });
    const pageUrl = safeHttpsUrl(body.sourceUrl);
    const pageResponse = await fetch(pageUrl, { redirect: "error", signal: AbortSignal.timeout(10000), headers: { "User-Agent": "HoopCheckLogoCandidateReview/1.0", Accept: "text/html,application/xhtml+xml" } });
    if (!pageResponse.ok) throw new Error("Source page returned HTTP " + pageResponse.status + ".");
    const pageType = (pageResponse.headers.get("content-type") || "").toLowerCase();
    if (!pageType.includes("text/html") && !pageType.includes("application/xhtml+xml")) throw new Error("Source URL must be a web page.");
    const html = (await pageResponse.text()).slice(0, 2_000_000);
    const imageUrl = getMetaImage(html, pageUrl);
    if (!imageUrl) throw new Error("No Open Graph image or Apple touch icon was found.");
    const candidateUrl = safeHttpsUrl(imageUrl);
    const imageResponse = await fetch(candidateUrl, { redirect: "error", signal: AbortSignal.timeout(10000), headers: { "User-Agent": "HoopCheckLogoCandidateReview/1.0", Accept: "image/png,image/jpeg,image/webp" } });
    if (!imageResponse.ok) throw new Error("Candidate image returned HTTP " + imageResponse.status + ".");
    const mimeType = (imageResponse.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!IMAGE_TYPES.has(mimeType)) throw new Error("Candidate image must be PNG, JPG, or WebP. Upload SVG files directly in the admin tool.");
    const bytes = await readLimited(imageResponse);
    if (bytes.length < 1024) throw new Error("Candidate image is too small to be a valid team logo.");
    const imageData = "data:" + mimeType + ";base64," + Buffer.from(bytes).toString("base64");
    return NextResponse.json({ imageData, mimeType, imageUrl: candidateUrl.toString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not fetch candidate logo." }, { status: 400 });
  }
}
