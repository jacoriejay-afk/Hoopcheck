import test from "node:test";
import assert from "node:assert/strict";
import { reviewedEntryFor } from "./team-logo-review-policy.mjs";

const row = { __table: "teams", id: "b374ce9f-fe59-46ce-b2af-fafb9552d74f", name: "Boca Juniors", country: "Argentina" };
const approved = {
  table: "teams",
  teamId: row.id,
  teamName: row.name,
  country: row.country,
  imageUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c9/Boca_escudo.png",
  sourcePage: "https://commons.wikimedia.org/wiki/File:Boca_escudo.png",
  rights: "public-domain",
  rightsEvidenceUrl: "https://commons.wikimedia.org/wiki/File:Boca_escudo.png",
  reviewedBy: "logo-editor",
  reviewedAt: "2026-11-22",
  approved: true,
};

test("an exact reviewed public-domain match is eligible", () => {
  assert.deepEqual(reviewedEntryFor(row, { entries: [approved] }), approved);
});
test("empty, absent, or contradictory evidence never publishes", () => {
  assert.equal(reviewedEntryFor(row, { entries: [] }), null);
  assert.equal(reviewedEntryFor(row, undefined), null);
  assert.equal(reviewedEntryFor(row, { entries: [approved, approved] }), null);
  for (const patch of [
    { approved: false },
    { country: "Brazil" }, { teamName: "Other club" }, { table: "womens_teams" },
    { teamId: "00000000-0000-4000-8000-000000000000" },
    { rights: "unknown" }, { reviewedBy: "" }, { reviewedAt: "yesterday" },
    { rightsEvidenceUrl: "http://commons.wikimedia.org/wiki/File:Boca_escudo.png" },
    { rightsEvidenceUrl: "https://commons.wikimedia.org.evil.example/file" },
    { imageUrl: "http://upload.wikimedia.org/image.png" },
    { imageUrl: "https://127.0.0.1/image.png" },
    { imageUrl: "https://upload.wikimedia.org/logos/boca.svg" },
    { sourcePage: "https://localhost/logo" },
  ]) assert.equal(reviewedEntryFor(row, { entries: [{ ...approved, ...patch }] }), null, JSON.stringify(patch));
});
test("written permission requires the same identity evidence", () => {
  assert.equal(reviewedEntryFor(row, { entries: [{ ...approved, rights: "written-permission", rightsEvidenceUrl: "https://club.example/permission" }] })?.teamId, row.id);
});
