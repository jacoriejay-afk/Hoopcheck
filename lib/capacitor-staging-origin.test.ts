import assert from "node:assert/strict";
import test from "node:test";

import { requireCapacitorStagingOrigin } from "./capacitor-staging-origin.ts";

test("requires a configured staging URL", () => {
  assert.throws(() => requireCapacitorStagingOrigin(undefined), /CAPACITOR_SERVER_URL is required/);
  assert.throws(() => requireCapacitorStagingOrigin("  "), /CAPACITOR_SERVER_URL is required/);
});

test("accepts an exact HTTPS staging origin and normalizes a trailing slash", () => {
  assert.deepEqual(
    requireCapacitorStagingOrigin(" https://staging.example.net/ "),
    { origin: "https://staging.example.net", hostname: "staging.example.net" },
  );
});

test("rejects production domain and all its subdomains", () => {
  for (const url of [
    "https://hoopcheck.online",
    "https://www.hoopcheck.online",
    "https://preview.hoopcheck.online",
    "https://hoopcheck.online.",
    "https://preview.hoopcheck.online.",
  ]) {
    assert.throws(() => requireCapacitorStagingOrigin(url), /Production HoopCheck hosts are blocked/);
  }
});

test("rejects insecure URLs, credentials, and URL components", () => {
  for (const url of [
    "http://staging.example.net",
    "https://user@staging.example.net",
    "https://staging.example.net/path",
    "https://staging.example.net/?next=1",
    "https://staging.example.net/#fragment",
  ]) {
    assert.throws(() => requireCapacitorStagingOrigin(url), /must be|Production HoopCheck hosts/);
  }
});
