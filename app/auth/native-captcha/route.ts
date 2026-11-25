import { randomBytes } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const baseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow",
  "Content-Type": "text/html; charset=utf-8",
};

export function GET() {
  const siteKey = process.env.NEXT_PUBLIC_AUTH_TURNSTILE_SITE_KEY?.trim();
  if (process.env.HOOPCHECK_NATIVE_CAPTCHA_ENABLED !== "true" || !siteKey || !/^[A-Za-z0-9_-]{1,128}$/.test(siteKey)) {
    return new Response("Security verification unavailable.", { status: 503, headers: baseHeaders });
  }
  const nonce = randomBytes(24).toString("base64");
  const csp = [
    "default-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'",
    "script-src 'nonce-" + nonce + "' https://challenges.cloudflare.com",
    "frame-src https://challenges.cloudflare.com",
    "connect-src https://challenges.cloudflare.com",
    "style-src 'unsafe-inline'",
  ].join("; ");
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HoopCheck security check</title><style>html{color-scheme:light dark}body{font:16px system-ui,sans-serif;margin:24px}#challenge{min-height:70px}p{line-height:1.5}</style></head><body><h1>Security check</h1><p>Complete this check to continue in HoopCheck.</p><div id="challenge"></div><p id="status" role="status">Loading verification…</p><script nonce="${nonce}">
(function () {
  "use strict";
  const status = document.getElementById("status");
  function send(state, token) {
    const bridge = window.ReactNativeWebView;
    if (!bridge || typeof bridge.postMessage !== "function") {
      status.textContent = "Open this check in the HoopCheck app.";
      return;
    }
    const message = { type: "hoopcheck-captcha", version: 1, status: state };
    if (state === "token") message.token = token;
    bridge.postMessage(JSON.stringify(message));
  }
  window.hoopcheckCaptchaReady = function () {
    try {
      window.turnstile.render("#challenge", {
        sitekey: "${siteKey}",
        callback: function (token) { status.textContent = "Verification received. Returning to HoopCheck…"; send("token", token); },
        "expired-callback": function () { status.textContent = "Verification expired."; send("expired"); },
        "error-callback": function () { status.textContent = "Verification failed. Close and retry."; send("error"); },
        "timeout-callback": function () { status.textContent = "Verification timed out. Close and retry."; send("error"); }
      });
      status.textContent = "Complete the verification.";
    } catch { status.textContent = "Security check unavailable."; send("error"); }
  };
  window.hoopcheckCaptchaError = function () { status.textContent = "Security check could not load."; send("error"); };
  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=hoopcheckCaptchaReady";
  script.async = true;
  script.onerror = window.hoopcheckCaptchaError;
  document.head.appendChild(script);
})();
</script></body></html>`, { headers: { ...baseHeaders, "Content-Security-Policy": csp } });
}
