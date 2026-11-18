import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../../app/api/native2/verification-video-download/route.ts", import.meta.url), "utf8");
test("verification video endpoint is independently disabled by default", () => {
  assert.match(source, /NATIVE2_VERIFICATION_VIDEO_DOWNLOADS_ENABLED !== "true"/);
  assert.match(source, /status: 404/);
});
test("server verifies JWT and looks up trusted request owner, never caller supplied owner", () => {
  assert.match(source, /auth\.getUser\(token\)/);
  assert.match(source, /\.eq\("owner_id", identity\.user\.id\)/);
  assert.match(source, /from\("player_verification_requests"\)/);
  assert.match(source, /\.eq\("id", asset\.request_id\)\.eq\("user_id", identity\.user\.id\)/);
  assert.match(source, /requestId: asset\.request_id, trustedRequestId: trustedRequest\.id/);
});
test("private signed URL only after owner authorization and expiration validation", () => {
  assert.match(source, /native2AuthorizeOwnerMedia\(/);
  assert.match(source, /expiresAt: asset\.expires_at/);
  assert.match(source, /storage\.from\("native2-verification-videos"\)/);
  assert.match(source, /createSignedUrl\(asset\.private_storage_path, 60\)/);
  assert.doesNotMatch(source, /getPublicUrl|createSignedUploadUrl/);
});
