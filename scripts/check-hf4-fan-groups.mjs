import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const feed = read("app/feed/page.tsx");
const moderate = read("app/api/hoopfeed/moderate/route.ts");
const sharedCss = read("app/hoopfeed-shared.css");
const migration = read("supabase/migrations/20261106170000_team_fan_groups.sql");
const groupApi = read("app/api/fan-groups/route.ts");
const groupPage = read("app/team-hub/groups/[teamId]/page.tsx");
const entry = read("components/TeamFanGroupEntry.tsx");

const checks = [
  ["HoopFeed composer uses existing 2,000-character server limit", /maxLength=\{2000\}/.test(feed) && /\{body\.length\}\/2000/.test(feed)],
  ["HoopFeed text body renders outside media wrapper", /hc-feed-post-body/.test(feed) && /<FeedMediaArea>\{p\.image_url/.test(feed)],
  ["HoopFeed API keeps 2,000-character limit and text-only moderation", /MAX_TEXT_LENGTH = 2000/.test(moderate) && /if \(text\) input\.push/.test(moderate)],
  ["Text-only posts have standard theme-aware typography", /\.hc-feed-post-body/.test(sharedCss) && /var\(--hc-foreground\)/.test(sharedCss)],
  ["One fan group is created for existing and future teams", /insert into public\.team_fan_groups/.test(migration) && /teams_ensure_fan_group/.test(migration)],
  ["Fan-only membership and member-only post reads are enforced by RLS", /p\.account_type='fan'/.test(migration) && /group members can read group posts/.test(migration)],
  ["Group media bucket is private and member-gated", /values\('fan-group-images','fan-group-images',false\)/.test(migration) && /fan group members read group images/.test(migration)],
  ["Group API implements join, approvals, member and moderator controls", ["join","review_request","set_join_mode","remove_member","appoint_co_moderator","pin_post","remove_post","report_post"].every(x => groupApi.includes('action === "' + x + '"'))],
  ["Group posts support permanent text/photo content and comments", /team_fan_group_posts/.test(migration) && /team_fan_group_comments/.test(migration) && /action === "comment"/.test(groupApi)],
  ["Fan-only group route and moderator panel are present", /profile\?\.account_type !== "fan"/.test(groupPage) && /Moderator panel/.test(groupPage)],
  ["Team page and Team Hub have fan group entry component", /TeamFanGroupEntry/.test(entry) && /TeamFanGroupEntry/.test(read("app/teams/[id]/page.tsx")) && /TeamFanGroupEntry/.test(read("app/team-hub/page.tsx"))],
];

let failed = false;
for (const [label, ok] of checks) {
  process.stdout.write((ok ? "PASS " : "FAIL ") + label + "\n");
  if (!ok) failed = true;
}
if (failed) process.exitCode = 1;
else process.stdout.write("\\nAll HF-4 / FAN-GRP-1 source checks passed.\\n");
