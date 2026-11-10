// Static regression contracts for the November audit fixes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const review = read('app/teams/[id]/review/page.tsx');
const formStart = review.indexOf('<form');
const checkbox = review.indexOf('name="reviewRulesAccepted"');
const formEnd = review.indexOf('</form>', formStart);
assert.ok(formStart >= 0 && checkbox > formStart && checkbox < formEnd, 'Required review agreement stays inside the review form');
assert.match(review.slice(Math.max(formStart, checkbox - 90), checkbox + 90), /required/, 'Review agreement remains required');
const women = read('app/womens/[id]/page.tsx');
assert.ok(women.includes('country={team.country || t("international")}'), 'Women profile passes raw country to shared hero');
assert.ok(!women.includes('country={\x60\x24{countryFlag'), 'Women profile does not prefix a flag twice');
const account = read('app/account/page.tsx');
assert.ok(account.includes('profile.account_type === "player" && <SettingsRow') && account.includes('label="Career Passport"') && account.includes('href="/profile#career-passport"'), 'Career Passport shortcut is player-only');
assert.ok(read('app/profile/page.tsx').includes('id="career-passport"'), 'Career Passport deep link target exists');
const css = read('app/hoopcheck-directory-profile.css');
assert.ok(css.includes('hc-team-logo__crest path { fill: none !important;'), 'Fallback crest outline remains hollow');
console.log('PASS: review agreement, shared country flag, Career Passport navigation, and crest outline');
