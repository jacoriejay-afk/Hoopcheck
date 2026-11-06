import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

async function loadTypeScriptModule(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

const client = await loadTypeScriptModule("../apps/mobile/src/billing/apple-account-token.ts");
const { getAppleAppAccountToken, AppleAccountTokenError } = client;
const token = "550e8400-e29b-41d4-a716-446655440000";

function response(body, { ok = true, status = 200, jsonThrows = false } = {}) {
  return {
    ok,
    status,
    async json() {
      if (jsonThrows) throw new Error("bad json");
      return body;
    },
  };
}

let capturedUrl = null;
let capturedOptions = null;
const fetchOk = async (url, options) => {
  capturedUrl = url;
  capturedOptions = options;
  return response({ appAccountToken: token });
};

assert.equal(
  await getAppleAppAccountToken("https://hoopcheck.online", "signed-in-access-token", fetchOk),
  token,
  "returns the server-issued UUID token",
);
assert.equal(capturedUrl, "https://hoopcheck.online/api/apple-iap/account-token");
assert.equal(capturedOptions.method, "POST");
assert.equal(capturedOptions.headers.Authorization, "Bearer signed-in-access-token");
assert.equal(capturedOptions.headers.Accept, "application/json");

await assert.rejects(
  getAppleAppAccountToken("https://hoopcheck.online", "  ", fetchOk),
  (error) => error instanceof AppleAccountTokenError && /Sign in/.test(error.message),
);
await assert.rejects(
  getAppleAppAccountToken("http://hoopcheck.online", "token", fetchOk),
  AppleAccountTokenError,
  "non-local HTTP origins are rejected",
);
await assert.rejects(
  getAppleAppAccountToken("https://user:pass@hoopcheck.online", "token", fetchOk),
  AppleAccountTokenError,
  "origins with embedded credentials are rejected",
);
await assert.rejects(
  getAppleAppAccountToken("https://hoopcheck.online?next=attacker", "token", fetchOk),
  AppleAccountTokenError,
  "origins with query strings are rejected",
);
await assert.rejects(
  getAppleAppAccountToken("not-a-url", "token", fetchOk),
  AppleAccountTokenError,
);

assert.equal(
  await getAppleAppAccountToken("http://localhost:3000", "token", fetchOk),
  token,
  "HTTP is allowed only for local development",
);
await assert.rejects(
  getAppleAppAccountToken("https://hoopcheck.online", "token", async () => {
    throw new Error("network down");
  }),
  (error) => error instanceof AppleAccountTokenError && /connect/.test(error.message),
);
await assert.rejects(
  getAppleAppAccountToken("https://hoopcheck.online", "token", async () => response(null, { jsonThrows: true })),
  AppleAccountTokenError,
);
await assert.rejects(
  getAppleAppAccountToken("https://hoopcheck.online", "token", async () =>
    response({ error: "temporarily unavailable" }, { ok: false, status: 503 })),
  (error) => error instanceof AppleAccountTokenError && error.message === "temporarily unavailable",
);
await assert.rejects(
  getAppleAppAccountToken("https://hoopcheck.online", "token", async () =>
    response({ appAccountToken: "not-a-uuid" })),
  AppleAccountTokenError,
);
await assert.rejects(
  getAppleAppAccountToken("https://hoopcheck.online", "token", async () =>
    response({})),
  AppleAccountTokenError,
);

console.log("Apple account-token client tests passed.");
