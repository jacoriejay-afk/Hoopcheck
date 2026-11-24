import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("Alerts exposes Activity, HoopChat and contact Requests in one accessible tablist", () => {
  const alerts = read("../app/notifications.tsx");
  assert.match(alerts, /accessibilityRole="tablist"/);
  assert.match(alerts, /id: "activity", label: "Activity"/);
  assert.match(alerts, /id: "chat", label: "HoopChat"/);
  assert.match(alerts, /id: "requests", label: "Requests"/);
  assert.match(alerts, /accessibilityRole="tab"/);
  assert.match(alerts, /accessibilityState=\{\{ selected: section === tab\.id \}\}/);
  assert.match(alerts, /<MessagesScreen embedded mode=\{section === "chat" \? "conversations" : "requests"\} \/>/);
  assert.doesNotMatch(alerts, /Messages & sender threads/);
});

test("embedded HoopChat reuses owner-scoped accepted threads and pending requests", () => {
  const messages = read("../app/messages.tsx");
  assert.match(messages, /embedded = false, mode = "all"/);
  assert.match(messages, /mode === "conversations" && row\.status === "accepted"/);
  assert.match(messages, /mode === "requests" && row\.status === "pending"/);
  assert.match(messages, /visibleThreads\.find\(item => item\.id === selectedId\) \|\| visibleThreads\[0\]/);
  assert.match(messages, /selected\.player_id!==userId \|\| selected\.status!=="pending"/);
  assert.match(messages, /selected\.status!=="accepted"/);
  assert.match(messages, /\.or\(`requester_id\.eq\.\$\{user\.id\},player_id\.eq\.\$\{user\.id\}`\)/);
  assert.match(messages, /withHoopChatDeadline\(async signal/);
  assert.match(messages, /HoopCheckLoading compact label="Loading conversations/);
  assert.match(messages, /\{!embedded \? <Button secondary onPress=\{\(\)=>router\.push\("\/notifications"\)\}>/);
});

test("Alerts keeps caller-only notification queries and clears private data at sign-out", () => {
  const alerts = read("../app/notifications.tsx");
  assert.match(alerts, /readNotifications\(supabase, data\.session\.user\.id\)/);
  assert.match(alerts, /markNotificationsRead\(supabase, userId/);
  assert.match(alerts, /hoopChatAuthAction\(event, owner\.current, session\?\.user\.id \?\? null\)/);
  assert.match(alerts, /if \(action === "ignore"\) return/);
  assert.match(alerts, /if \(action === "clear"\)/);
  assert.match(alerts, /owner\.current = null; setRows\(\[\]\)/);
  assert.match(alerts, /onPress=\{\(\) => void openNotice\(item\)\}/);
  assert.doesNotMatch(alerts, /onAuthStateChange\(\(\) =>/);
});

test("Activity avoids heavyweight cards and uses the shared reduced-motion loading state", () => {
  const alerts = read("../app/notifications.tsx");
  assert.match(alerts, /<HoopCheckLoading compact label="Checking activity/);
  assert.match(alerts, /borderBottomWidth: 1/);
  assert.match(alerts, /fontSize: 14, fontWeight: "800"/);
  assert.doesNotMatch(alerts, /<GlassCard/);
  assert.match(alerts, /noticeMatches\(item, filter\)/);
});

test("Home and Account HoopChat shortcuts deep-link to the Alerts conversation tab", () => {
  const alerts = read("../app/notifications.tsx");
  const home = read("../app/dashboard.tsx");
  const account = read("../app/account.tsx");
  assert.match(alerts, /useLocalSearchParams<\{ tab\?: string \}>\(\)/);
  assert.match(alerts, /tab === "chat" \? "chat" : tab === "requests" \? "requests"/);
  assert.match(alerts, /if \(tab === "chat" \|\| tab === "requests" \|\| tab === "activity"\) setSection\(tab\)/);
  assert.match(home, /item\.label==="HoopChat"\) router\.push\(\{pathname:"\/notifications",params:\{tab:"chat"\}\}\)/);
  assert.match(account, /title="HoopChat & requests"[^\n]*onPress=\{\(\)=>router\.push\(\{pathname:"\/notifications",params:\{tab:"chat"\}\}\)\}/);
});
