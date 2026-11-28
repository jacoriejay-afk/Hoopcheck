import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
test("HoopChat starts with inbox and requires explicit, mode-scoped thread selection", () => {
  const chat = read("../app/messages.tsx");
  assert.match(chat, /const \[openedId, setOpenedId\] = useState\(""\)/);
  assert.match(chat, /selected\.id === openedId && openedMode === mode/);
  assert.match(chat, /!opened&&\(visibleThreads\.length>0\|\|serverInboxEnabled\)/);
  assert.match(chat, /if\(linkKey&&consumedLink\.current!==linkKey\)/);
  assert.match(chat, /const linked=result\.rows\.find\(row=>row\.id===threadHint&&row\.status==="accepted"\)/);
  assert.match(chat, /opened&&selected/);
  assert.match(chat, /accessibilityLabel="Back to conversations"/);
  assert.doesNotMatch(chat, /<ScrollView horizontal/);
  assert.match(chat, /selected\.status!=="accepted" \|\| !opened/);
  assert.match(chat, /selected\.status!=="pending" \|\| !opened/);
  assert.match(chat, /actionGeneration!==generation\.current \|\| !focused\.current/);
  assert.match(chat, /setUserId\(""\); setSelectedId\(""\); setOpenedId\(""\)/);
  assert.match(chat, /const draftThread = opened && selected\?\.status === "accepted" \? selected\.id : ""/);
  assert.match(chat, /useNativeDraft\(\x60contact:chat:\$\{draftThread\}\x60, draftThread \? userId : undefined\)/);
  assert.match(chat, /onBlocked=\{\(\)=>\{historyRequest\.current\+\+;setOpenedId\(""\);setDraft\(""\)/);
  const drafts = read("../src/native/drafts.tsx");
  assert.match(drafts, /onAuthStateChange\(\(_event, session\) => store\.switchUser\(session\?\.user\.id \?\? null\)\)/);
  assert.match(drafts, /store\.switchUser\(null\)/);
  const store = read("../src/native/draftStore.ts");
  assert.match(store, /owner = next; values = new Map\(\); notify\(\)/);
  assert.match(store, /userId && userId === owner \? values\.get\(key\) \|\| "" : ""/);
});
test("Home sections have bounded waits and preserve caller identity checks", () => {
  const home = read("../components/HomeCourtside.tsx");
  assert.match(home, /withHoopChatDeadline\(\(\) => supabase\.auth\.getSession\(\), 5000\)/);
  assert.match(home, /Promise\.allSettled/);
  assert.match(home, /withHoopChatDeadline\(\(\) => readBasketballSide/);
  assert.match(home, /withHoopChatDeadline\(\(\) => readFeedPage/);
  assert.match(home, /after\.data\.session\?\.user\.id !== uid/);
  assert.match(home, /snapshot\?\.scope===scope/);
  assert.match(home, /current\?\.scope === scope \? Object\.fromEntries/);
});
test("Logo loading uses a named crest fallback without a spinner", () => {
  const art = read("../components/EntityArtwork.tsx");
  assert.match(art, /!loaded \? <View pointerEvents="none"/);
  assert.match(art, /opacity: loaded \? 1 : 0/);
  assert.match(art, /if \(failed\) return <DirectoryCrest/);
  assert.doesNotMatch(art, /ActivityIndicator/);
  assert.match(art, /value\.protocol === "https:"/);
});

test("HoopGroups uses a compact community directory while preserving owner settings and launch gate", () => {
  const groups = read("../components/HoopGroupsChannels.tsx");
  const screen = read("../app/hoopgroups.tsx");
  assert.match(groups, /accessibilityLabel="Community directory"/);
  assert.doesNotMatch(groups, /width:160/);
  assert.match(groups, /borderColor:accent\(space\.accent_color\)/);
  assert.match(groups, /managing && selected\?\.owner_id===userId/);
  assert.match(groups, /setEditing\(false\);setSpaceId\(space\.id\)/);
  assert.match(groups, /Report or block/);
  assert.match(screen, /EXPO_PUBLIC_HOOPGROUPS_CHANNELS_ENABLED === "true"/);
  assert.match(screen, /not enabled in this release yet/);
});


test("HoopGroups resets local state across account changes and scopes private channel content", () => {
  const groups = read("../components/HoopGroupsChannels.tsx");
  assert.match(groups, /<ScopedHoopGroups key=\{JSON\.stringify\(\[userId,offline\]\)\}/);
  assert.match(groups, /const posts=member&&channel&&postSnapshot\?\.channelId===channel\.id\?postSnapshot\.posts:\[\]/);
  assert.match(groups, /const draft=member&&channel&&draftState\?\.channelId===channel\.id\?draftState\.value:""/);
  assert.match(groups, /if\(!alive\|\|controller\.signal\.aborted\)return;/);assert.match(groups, /if\(readError\|\|controller\.signal\.aborted\)throw Error/);
  assert.match(groups, /if\(alive\)setPostSnapshot\(\{channelId:channel!\.id,posts:/);assert.match(groups, /filter\(post=>!blocked\.has\(post\.author_id\)\)/);
  assert.match(groups, /const managing=editing&&editingGroupId===selected\?\.id/);
  assert.match(groups, /if\(!selected \|\| !managing \|\| !userId/);
  const join = groups.slice(groups.indexOf("async function join()"), groups.indexOf("async function createGroup()"));
  assert.match(join, /setGroupMembership\(supabase,userId,/);
  const membership = read("../src/native/groupMembership.ts");
  assert.match(membership, /client\.auth\.getUser\(token\)/);
  assert.match(membership, /latest\.data\.session\?\.user\.id!==uid/);
  assert.match(membership, /setHeader\("Authorization",header\)\.abortSignal\(signal\)/);
  assert.match(groups, /supabase\.auth\.getUser\(token\)/);
  assert.match(groups, /verified\.data\.user\?\.id!==userId/);
});

test("HoopChat locks mutations before awaits and preserves unsent draft text", () => {
  const chat = read("../app/messages.tsx");
  assert.match(chat, /const mutationLocked = useRef\(false\)/);
  assert.match(chat, /async function respond[\s\S]*?mutationLocked\.current\) return;\s*mutationLocked\.current=true;\s*const actionGeneration/);
  assert.match(chat, /async function send\(\)[\s\S]*?mutationLocked\.current\) return;\s*mutationLocked\.current=true;\s*const submittedDraft=draft/);
  assert.match(chat, /prepareConversationMessage\(pendingMessages\.current,selected\.id,userId,submittedDraft,randomUUID,replyId\)/);
  assert.match(chat, /await sendConversationMessage\(supabase,message,signal,header\)/);
  assert.match(chat, /setDraft\(current=>current===submittedDraft\?"":current\)/);
  assert.match(chat, /if\(!mutationLocked\.current\)void load\(\)/);
  assert.match(chat, /editable=\{!sending && !offline\}/);
  assert.equal((chat.match(/finally\{mutationLocked\.current=false;setSending\(false\);\}/g) || []).length, 2);
});
