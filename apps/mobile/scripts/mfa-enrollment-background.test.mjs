import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const screen = readFileSync(new URL("../app/account/security.tsx", import.meta.url), "utf8");

test("backgrounding invalidates an in-flight enrollment and clears existing setup secrets", () => {
  assert.match(screen, /if \(state !== "active"\) \{ visibilityEpoch\.current\+\+; setCode\(""/);
  assert.match(screen, /setSetup\(current => current \? \{ \.\.\.current, qr: "", secret: "" \} : null\)/);
});

test("enrollment captures the visibility epoch before the request and redacts delayed results", () => {
  const capture = screen.indexOf("const enrollmentEpoch = visibilityEpoch.current");
  const request = screen.indexOf("await enrollTotp(supabase, owner, name)");
  const guard = screen.indexOf('visibilityEpoch.current === enrollmentEpoch && AppState.currentState === "active" ? result : { id: result.id, qr: "", secret: "" }');
  assert.ok(capture >= 0 && capture < request && request < guard);
  assert.match(screen, /await cancelTotpEnrollment\(supabase, owner, factorId \|\| setup\?\.id/);
  assert.match(screen, /The setup key was cleared when the app left the foreground/);
});
