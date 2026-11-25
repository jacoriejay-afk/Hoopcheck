import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const sql = read("supabase/seed-verified-international-teams-20261122.sql");
const admin = read("app/admin/team-logos/page.tsx");
const review = read("docs/team-logo-source-review-20261122.md");

assert.match(sql, /begin;\s*select pg_advisory_xact_lock/);
assert.match(sql, /commit;\s*$/);
assert.match(sql, /insert into public\.teams\(name,city,country,league_name,league_id,active,basketball_type,source\)/);
assert.match(sql, /insert into public\.womens_teams\(name,city,country,league_name,league_id,active\)/);
assert.doesNotMatch(sql, /insert into public\.teams[^;]*'womens_teams_mirror'/is, "Mirror must be trigger-owned");
assert.doesNotMatch(sql, /\b(?:drop|truncate|alter|grant|revoke)\s+(?:table|policy|role|function|on)\b/i);
assert.doesNotMatch(sql, /\bdelete\s+from\b/i);
assert.match(sql, /where not exists \(/);
assert.match(sql, /and t\.basketball_type='mens'/);
assert.match(sql, /wt\.country='Mexico'/);
assert.match(sql, /coalesce\(t\.source,''\) <> 'womens_teams_mirror'/);
assert.match(sql, /t\.source = 'HoopCheck verified 2026-27 roster'/);
assert.match(sql, /nullif\(btrim\(coalesce\(t\.logo_url, ''\)\), ''\) is null/);

const womenText = sql.split("-- womens_teams is the authoritative source for these clubs.")[1] || "";
const mensText = sql.split("-- Never insert a men's club")[1]?.split("-- Small source-reviewed")[0] || "";
const clubPattern = /\('((?:[^']|'')+)','((?:[^']|'')+)','((?:[^']|'')+)'\)/g;
const parse = s => [...s.matchAll(clubPattern)].map(m => ({ name: m[1], city: m[2], league: m[3] }));
const men = parse(mensText);
const women = parse(womenText);
assert.equal(men.length, 40, "Expected 40 men’s club entries");
assert.equal(women.length, 14, "Expected 14 women’s club entries");
assert.equal(men.filter(x => x.league === "Liga Nacional de Básquet").length, 6);
assert.equal(men.filter(x => x.league === "La Liga Argentina").length, 34);
assert.equal(women.filter(x => x.league === "LNBP Femenil").length, 8);
assert.equal(women.filter(x => x.league === "Liga de México (LMBPF)").length, 6);
for (const set of [men, women]) {
  const key = x => x.name.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, "");
  assert.equal(new Set(set.map(key)).size, set.length, "Duplicate club in seed");
}
assert.ok(sql.includes("https://upload.wikimedia.org/wikipedia/commons/4/49/Atenas_cordoba_logo.png"));
assert.ok(sql.includes("https://upload.wikimedia.org/wikipedia/commons/4/41/Escudo_del_Club_Ciclista_Ol%C3%ADmpico.png"));
assert.match(review, /trademark/i);
assert.match(review, /DO NOT USE:[^\n]+/);
assert.match(admin, /Logo review queue/);
assert.match(admin, /queueGender/);
assert.match(admin, /queueCoverage/);
assert.match(admin, /rightsReviewed/);
assert.match(admin, /\!rightsReviewed/);
console.log("PASS: 40 missing men + 14 missing women, two source-reviewed crests, idempotent mirror-safe seed, guarded logo review queue.");

await import('./test-directory-reconciliation.mjs');
