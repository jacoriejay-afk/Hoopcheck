import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
test("Account refreshes verified own appearance on return from edit and manual refresh", () => {
  const account = read("../app/account.tsx");
  assert.match(account, /const activeScreen=useActiveScreen\(\)/);
  assert.match(account, /if\(!activeScreen\)return/);
  assert.match(account, /readOwnCover\(supabase,uid\)\.then\(value=>\{if\(active\)setCover\(\{owner:uid,value\}\)/);
  assert.match(account, /\[account\?\.user\.id,activeScreen,appearanceRevision\]/);
  assert.match(account, /retry\(\);setAppearanceRevision\(value=>value\+1\)/);
  assert.match(account, /cover\?\.owner===account\?\.user\.id\?profileCovers\.find/);
  assert.match(account, /avatar\.owner===account\.user\.id\?avatar\.url:null/);
  assert.match(account, /avatar_moderation_status==="approved"/);
  assert.match(account, /active=false;controller\.abort\(\)/);
});
test("Preset cover stays private to verified owner and is not added to public RPC", () => {
  const editor = read("../app/account/edit.tsx");
  const client = read("../src/native/profileEditor.ts");
  const publicReader = read("../src/native/playerProfiles.ts");
  assert.match(editor, /This does not change your public player profile/);
  assert.match(editor, /fontFamily: "HoopCheckDisplay"[^\n]+Edit your profile/);
  assert.match(client, /data\.user\?\.id !== userId/);
  assert.match(client, /return profileCover\(data\.user\.user_metadata\?\.hoopcheck_profile_cover\)/);
  assert.doesNotMatch(publicReader, /hoopcheck_profile_cover|user_metadata/);
});
