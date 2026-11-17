// Inventory public HoopFeed media dependencies before private-bucket migration.
// Run: node scripts/audit-hoopfeed-media-privacy.mjs
// This is a non-mutating audit; it deliberately does not declare privacy safe.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const surfaces = [
  ["HoopFeed moderation", "app/api/hoopfeed/moderate/route.ts"],
  ["HoopFeed composer", "app/feed/page.tsx"],
  ["Fan Feed moderation", "app/api/fan-feed/moderate/route.ts"],
  ["Team Fan Feed", "app/api/team-fanfeed/route.ts"],
];
const rows = [];
for (const [surface, file] of surfaces) {
  const lines = readFileSync(file, "utf8").split("\n");
  for (const [index, line] of lines.entries()) {
    if (/feed-images|feed-videos|hoopfeed-private-images|hoopfeed-private-videos|getPublicUrl\(/.test(line)) {
      rows.push({ surface, file, line: index + 1,
        images: line.includes("feed-images") || line.includes("hoopfeed-private-images"),
        videos: line.includes("feed-videos"),
        publicUrl: line.includes("getPublicUrl(") });
    }
  }
}
assert(rows.length > 0, "No media references found; review inventory inputs.");
const hoopfeedMedia = rows.filter(row => row.surface === "HoopFeed moderation" || row.surface === "HoopFeed composer");
assert(hoopfeedMedia.some(row => row.images), "HoopFeed image bucket reference missing; review upload migration.");
assert(hoopfeedMedia.some(row => row.videos), "HoopFeed video bucket reference missing; review upload migration.");
const fanSurfaces = rows.filter(row => /Fan Feed/.test(row.surface));
assert(fanSurfaces.length > 0, "Expected Fan Feed and Team Fan Feed media references.");
assert(!fanSurfaces.some(row => row.publicUrl), "Legacy fan surfaces must not generate public media URLs.");
const hoopfeed = rows.filter(row => row.surface.startsWith("HoopFeed"));
const newUploadPublicUrlReferences = hoopfeed.filter(row => row.publicUrl);
// No public URL references in new upload paths is progress, not a historical migration pass.
console.log(JSON.stringify({
  finding: "PUBLIC_MEDIA_MIGRATION_STILL_REQUIRED",
  newUploadPublicUrlReferences: newUploadPublicUrlReferences.length,
  note: "Post RLS does not protect public storage URLs. This inventory is not a privacy pass.",
  references: rows,
}, null, 2));
