import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [motion, css, trust, home, nav, teams, teamProfile, review, verification, claim, claimsAdmin, layout] = await Promise.all([
  read("../components/HoopMotion.tsx"),
  read("../app/hoopcheck-motion.css"),
  read("../components/TrustScoreDial.tsx"),
  read("../app/HomeClient.tsx"),
  read("../components/BottomNav.tsx"),
  read("../app/teams/page.tsx"),
  read("../app/teams/[id]/page.tsx"),
  read("../app/teams/[id]/review/page.tsx"),
  read("../app/verification/page.tsx"),
  read("../components/ClaimProfileButton.tsx"),
  read("../app/admin/claims/page.tsx"),
  read("../app/layout.tsx"),
]);

assert.match(motion, /export function MotionNumber/);
assert.match(motion, /export function HoopCheckDraw/);
assert.match(motion, /export function PlayerCardSkeletons/);
assert.match(motion, /export function usePullToRefresh/);
assert.match(motion, /export function MotionSwoosh/);
assert.match(motion, /prefers-reduced-motion/);
assert.match(css, /--hc-motion-reveal/);
assert.match(css, /hc-motion-shimmer/);
assert.match(css, /hc-motion-ball-bounce/);
assert.match(css, /hc-motion-swoosh/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(trust, /animatedScore < 40/);
assert.match(trust, /animatedScore < 70/);
assert.match(trust, /MotionNumber value=\{safeScore\}/);
assert.match(trust, /strokeDashoffset=\{revealed \? offset : circumference\}/);
assert.match(home, /from\("teams"\).*count: "exact"/s);
assert.match(home, /from\("leagues"\).*count: "exact"/s);
assert.match(home, /hc-motion-directory-counts/);
assert.match(nav, /MotionSwoosh active=\{swooshActive\}/);
assert.match(teams, /usePullToRefresh/);
assert.match(teams, /PlayerCardSkeletons count=\{5\}/);
assert.match(teamProfile, /PlayerCardSkeletons count=\{4\}/);
assert.match(review, /HoopCheckDraw label="Review submitted"/);
assert.match(verification, /HoopCheckDraw label="Profile verified"/);
assert.match(verification, /HoopCheckDraw label="Verification request submitted"/);
assert.match(claim, /HoopCheckDraw label="Team claim submitted"/);
assert.match(claimsAdmin, /HoopCheckDraw label="Team claim approved"/);
assert.match(layout, /hoopcheck-motion\.css/);
console.log("SHARED_MOTION_REGRESSION=PASS");
console.log("COVERAGE=trust-score,home-counters,check-confirmations,pull-to-refresh,tab-swoosh,skeletons,reduced-motion");
