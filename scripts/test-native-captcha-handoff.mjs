import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(path) {
  const source = readFileSync(new URL("../" + path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  new Function("exports", "require", outputText)(exports, require);
  return exports;
}
const { parseNativeCaptchaMessage, NATIVE_CAPTCHA_URL } = load("apps/mobile/src/native/captchaMessage.ts");
const envelope = (status, token) => JSON.stringify({type:"hoopcheck-captcha",version:1,status,...(token === undefined ? {} : {token})});
test("only exact challenge URL can deliver a token", () => {
  assert.deepEqual(parseNativeCaptchaMessage(NATIVE_CAPTCHA_URL, envelope("token","fixture")), {status:"token",token:"fixture"});
  for (const url of ["http://hoopcheck.online/auth/native-captcha","https://hoopcheck.online.evil.example/auth/native-captcha",NATIVE_CAPTCHA_URL+"?token=fixture",NATIVE_CAPTCHA_URL+"#fragment","https://hoopcheck.online/login"]) assert.equal(parseNativeCaptchaMessage(url,envelope("token","fixture")),null);
});
test("rejects malformed, oversized, ambiguous and unknown messages", () => {
  for (const value of ["not-json","null","[]",envelope("token",""),envelope("token","two words"),envelope("token","x".repeat(2049)),envelope("expired","unexpected"),envelope("other"),JSON.stringify({type:"hoopcheck-captcha",version:2,status:"token",token:"fixture"}),JSON.stringify({type:"hoopcheck-captcha",version:1,status:"token",token:"fixture",redirect:"https://evil.example"})]) assert.equal(parseNativeCaptchaMessage(NATIVE_CAPTCHA_URL,value),null);
});
test("expiration and error carry no token", () => {
  for (const status of ["expired","error"]) assert.deepEqual(parseNativeCaptchaMessage(NATIVE_CAPTCHA_URL,envelope(status)),{status});
});
test("hosted challenge stays off by default and rejects unsafe configuration", async () => {
  const { GET } = load("app/auth/native-captcha/route.ts");
  const previousEnabled=process.env.HOOPCHECK_NATIVE_CAPTCHA_ENABLED, previousKey=process.env.NEXT_PUBLIC_AUTH_TURNSTILE_SITE_KEY;
  try {
    delete process.env.HOOPCHECK_NATIVE_CAPTCHA_ENABLED;
    process.env.NEXT_PUBLIC_AUTH_TURNSTILE_SITE_KEY="fixture-key";
    assert.equal(GET().status,503);
    process.env.HOOPCHECK_NATIVE_CAPTCHA_ENABLED="true";
    process.env.NEXT_PUBLIC_AUTH_TURNSTILE_SITE_KEY='<script>';
    assert.equal(GET().status,503);
    process.env.NEXT_PUBLIC_AUTH_TURNSTILE_SITE_KEY="fixture-key";
    const response=GET();
    assert.equal(response.status,200);
    assert.match(response.headers.get("Cache-Control"),/no-store/);
    assert.equal(response.headers.get("Referrer-Policy"),"no-referrer");
    const csp=response.headers.get("Content-Security-Policy");
    assert.match(csp,/default-src 'none'/);
    assert.match(csp,/frame-ancestors 'none'/);
    const html=await response.text();
    assert.match(html,/ReactNativeWebView/);
    assert.match(html,/postMessage/);
    assert.match(html,/fixture-key/);
    const nonce=/nonce="([^"]+)"/.exec(html)[1];
    assert.ok(csp.includes("'nonce-"+nonce+"'"));
    assert.ok(!html.includes("localStorage") && !html.includes("document.cookie") && !html.includes("location.href"));
  } finally {
    if(previousEnabled===undefined) delete process.env.HOOPCHECK_NATIVE_CAPTCHA_ENABLED; else process.env.HOOPCHECK_NATIVE_CAPTCHA_ENABLED=previousEnabled;
    if(previousKey===undefined) delete process.env.NEXT_PUBLIC_AUTH_TURNSTILE_SITE_KEY; else process.env.NEXT_PUBLIC_AUTH_TURNSTILE_SITE_KEY=previousKey;
  }
});
