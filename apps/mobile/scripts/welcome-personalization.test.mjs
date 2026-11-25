import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
test('welcome personalization is device-scoped and role choice only prefills registration', () => {
  const screen=read('../components/Onboarding.tsx'), lock=read('../components/AppLock.tsx');
  assert.match(screen, /!signedIn && role \? \{ role \}/);
  assert.match(screen, /skip \? \{ onboardingDone: true \}/);
  assert.match(screen, /!ready \|\| preferences\.onboardingDone/);
  assert.match(screen, /theme: appearance, haptics/);
  assert.doesNotMatch(screen, /supabase|auth\.updateUser|appLock:/);
  assert.match(lock, /!needsLock \? <Onboarding key=\{userId \?\? "guest"\} signedIn=\{Boolean\(userId\)\}/);
  for (const role of ['player','fan','coach','agent','scout','manager']) assert.ok(screen.includes('role: "'+role+'"'));
});

test('welcome uses the canonical theme resolver and exposes Midnight Black', () => {
  const screen=read('../components/Onboarding.tsx');
  assert.match(screen, /getEntryTheme\(themeIsDark\(appearance, system\), appearance === "midnight"\)/);
  assert.match(screen, /value: "midnight", label: "Midnight Black"/);
});
