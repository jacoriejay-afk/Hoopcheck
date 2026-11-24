import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("Build 11 Home hamburger opens a real owner menu in an isolated header island", () => {
  const dashboard=read("../app/dashboard.tsx");
  assert.match(dashboard,/accessibilityLabel="Open account menu"/);
  assert.match(dashboard,/accessibilityState=\{\{expanded:menuOpen\}\}/);
  assert.match(dashboard,/setMenuOpen\(open=>!open\)/);
  assert.match(dashboard,/menuOpen \? <GlassSurface/);
  assert.match(dashboard, /<BrandLogo onHero=\{theme\.dark\} \/>/, 'Header logo must remain legible in light and dark glass');
  for (const route of ["/account","/messages","/hoopgroups","/settings","/about"]) {
    assert.ok(dashboard.includes(`path:"${route}"`), "Menu route "+route);
  }
  assert.match(dashboard,/edges=\{\["top", "left", "right", "bottom"\]\}/);
  assert.match(dashboard,/onScrollBeginDrag=\{\(\)=>setMenuOpen\(false\)\}/);
  assert.doesNotMatch(dashboard,/pathname:"\/web"/);
});

test("Build 11 HoopFeed is compact, keeps Posts/Reels and owner-only confirmed deletion", () => {
  const feed=read("../app/feed.tsx");
  assert.doesNotMatch(feed,/CourtsideBanner/);
  assert.match(feed,/accessibilityLabel=\{value \? "Reels" : "HoopFeed"\}/);
  assert.match(feed,/\{value \? "REELS" : "POSTS"\}/);
  assert.match(feed,/accessibilityLabel="Delete your HoopFeed post"/);
  assert.match(feed,/if \(!uid \|\| post\.author_id !== uid\) return/);
  assert.match(feed,/Alert\.alert\("Delete your post\?"/);
  assert.match(feed,/await deleteOwnedFeedPost\(supabase, uid, post\.id\)/);
  assert.match(feed,/previous\.posts\.filter\(item => item\.id !== post\.id\)/);
  assert.match(feed,/features\.canWriteHoopFeed/);
  assert.match(feed,/features\.canReadHoopFeed/);
  assert.match(feed,/HoopCheckLoading/);
  assert.match(feed,/height=\{reels \? Math\.max\(120, height - 280\) : 220\}/);
  const media=read("../components/FeedMedia.tsx");
  assert.match(media,/Math\.min\(260, Math\.max\(120,/);
});

test("Build 11 Account owns its header and groups account, membership, safety, workspaces", () => {
  const account=read("../app/account.tsx"),layout=read("../app/_layout.tsx");
  assert.match(account,/Your account/);
  assert.match(account,/ProfileAvatar/);
  assert.match(account,/MembershipPreview/);
  assert.match(account,/Membership and restore purchases/);
  assert.match(account,/HoopChat · messages and requests/);
  assert.match(account,/Two-factor authentication/);
  assert.doesNotMatch(account,/pathname:"\/web"/);
  assert.match(account,/Career Passport · My Journey/);
  assert.match(account,/signOut\(\{ scope: "local" \}\)/);
  assert.match(layout,/name="account" options=\{\{ headerShown: false \}\}/);
  assert.match(account,/HoopCheckLoading/);
});

test("Build 11 keeps nav tabs accessible and uses one floating island without active icon boxes",()=>{
  const nav=read("../components/TabBar.tsx");
  assert.match(nav,/isLiquidGlassAvailable\(\)/);
  assert.match(nav,/marginHorizontal: 20 \+ Math\.max/);
  assert.match(nav,/borderRadius: 31/);
  assert.match(nav,/activeWidth - 18/);
  assert.match(nav,/basketball-outline/);
  assert.match(nav,/person-circle-outline/);
  assert.match(nav,/accessibilityRole="tablist"/);
  assert.doesNotMatch(nav,/backgroundColor: theme\.dark \? "rgba\(255,112,39,\.22\)"/);
});

test("Build 11 HoopGroups are independently created and joined, never routed to club fan groups",()=>{
  const groups=read("../app/hoopgroups.tsx");
  const channels=read("../components/HoopGroupsChannels.tsx");
  const links=read("../components/ExploreLinks.tsx");
  assert.match(groups,/independent communities/);
  assert.doesNotMatch(groups,/Browse official Team Fan Groups/);
  assert.match(groups,/EXPO_PUBLIC_HOOPGROUPS_CHANNELS_ENABLED === "true"/);
  assert.match(channels,/Search HoopGroups/);
  assert.match(channels,/Create group/);
  assert.match(channels,/hoop_group_spaces/);
  assert.match(channels,/hoop_group_members/);
  assert.match(channels,/hoop_group_channels/);
  assert.match(channels,/hoop_group_reports/);
  assert.match(channels,/hoop_group_blocks/);
  assert.match(channels,/eq\("user_id",userId\)/);
  assert.match(links,/href: "\/hoopgroups", title: "HoopGroups"/);
  assert.doesNotMatch(links,/Find your club’s fan community/);
});

test("Build 11 shows stored approved team logos on Home and Live game scores with authored fallback",()=>{
  const home=read("../components/HomeCourtside.tsx");
  const games=read("../src/native/liveGames.ts");
  const scoreboard=read("../components/Scoreboard.tsx");
  const artwork=read("../components/EntityArtwork.tsx");
  assert.match(home,/select\("id,logo_url,logo_bg"\)/);
  assert.match(home,/logoUrl=\{data\.logos\[team\.target_id\]\?\.url\}/);
  assert.match(games,/select\("id,name,logo_url,logo_bg"\)/);
  assert.match(scoreboard,/logoUrl=\{team\.logo\}/);
  assert.match(artwork,/DirectoryCrest/);
  assert.match(artwork,/value\.protocol === "https:"/);
});

test("Build 11 does not flash Account loading on harmless token refresh",()=>{
  const provider=read("../src/native/useNativeAccount.ts");
  assert.match(provider, /event === "SIGNED_OUT"/);
  assert.match(provider, /event === "USER_UPDATED"/);
  assert.match(provider, /event === "SIGNED_IN" && nextId !== security\.owner/);
  assert.doesNotMatch(provider, /onAuthStateChange\(retry\)/);
  assert.match(provider, /result\.user\.id !== data\.session\.user\.id/);
  assert.match(provider, /security\.phase !== "ready"/);
});

test("Build 11 loading animations resolve statically with reduced motion enabled",()=>{
  const loading=read("../components/HoopCheckLoading.tsx");
  assert.match(loading,/useMotionSetting\(\)/);
  assert.match(loading,/if \(reduced\) \{ breathe\.set\(1\); return; \}/);
  assert.match(loading,/withRepeat\(withTiming\(1,/);
  assert.match(loading,/accessibilityRole="progressbar"/);
});
