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
    if (/feed-images|feed-videos|getPublicUrl\(/.test(line)) {
      rows.push({ surface, file, line: index + 1,
        images: line.includes("feed-images"),
        videos: line.includes("feed-videos"),
        publicUrl: line.includes("getPublicUrl(") });
    }
  }
}
assert(rows.length > 0, "No media references found; review inventory inputs.");
const fanSurfaces = rows.filter(row => /Fan Feed/.test(row.surface));
assert(fanSurfaces.some(row => row.images), "Expected shared fan-feed image bucket; review migration assumptions.");
const hoopfeed = rows.filter(row => row.surface.startsWith("HoopFeed"));
assert(hoopfeed.some(row => row.publicUrl), "Expected HoopFeed public URL dependency; update the rollout inventory.");
console.log(JSON.stringify({
  finding: "PUBLIC_MEDIA_DEPENDENCIES_PRESENT",
  note: "Post RLS does not protect public storage URLs. This inventory is not a privacy pass.",
  references: rows,
}, null, 2));
