import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/supabase-url.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
});
const { validateSupabaseUrl } = await import(`data:text/javascript,${encodeURIComponent(outputText)}`);

test("accepts a Supabase project root with or without a trailing slash", () => {
  assert.equal(validateSupabaseUrl("https://example.supabase.co"), null);
  assert.equal(validateSupabaseUrl("https://example.supabase.co/"), null);
});

test("rejects missing configuration and URLs that would produce invalid auth endpoints", () => {
  for (const value of [
    undefined, "", "example.supabase.co", "http://example.supabase.co",
    "https://example.supabase.co/auth/v1", "https://example.supabase.co/rest/v1",
    "https://example.supabase.co/auth/..", "https://example.supabase.co/?env=test",
    "https://example.supabase.co/#config", "https://example.supabase.co:8443",
    "https://example.supabase.co.evil.example", "https://user@example.supabase.co",
  ]) {
    assert.equal(typeof validateSupabaseUrl(value), "string", String(value));
  }
});
