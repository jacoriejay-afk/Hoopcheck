/* eslint-disable @typescript-eslint/no-require-imports -- Node-only Playwright fixture. */
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const base = new URL(process.env.THEME_TEST_BASE_URL || "http://127.0.0.1:3000");
if (!["127.0.0.1", "localhost"].includes(base.hostname)) throw Error("Use the loopback fixture only.");

const user = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", role: "authenticated", email: "reset@example.test", app_metadata: {}, user_metadata: {} };
const exp = Math.floor(Date.now() / 1000) + 3600;
const part = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const session = {
  user, access_token: `${part({ alg: "HS256" })}.${part({ sub: user.id, session_id: "fixture-session", role: user.role, exp })}.fixture`,
  refresh_token: "fixture-refresh", expires_at: exp, expires_in: 3600, token_type: "bearer",
};

async function run(browser) {
  const context = await browser.newContext({ serviceWorkers: "block" });
  try {
    const calls = [];
    let password = "original fixture password";
    let used = false;
    await context.routeWebSocket("**/*", socket => socket.close());
    await context.route("**/*", async route => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.origin === base.origin) return route.continue();
      if (url.hostname !== "ci.invalid") return route.abort();
      const json = (body, status = 200) => route.fulfill({ status, json: body, headers: {
        "access-control-allow-origin": base.origin, "access-control-allow-headers": "*", "access-control-allow-methods": "GET,PUT,POST,OPTIONS",
      } });
      if (req.method() === "OPTIONS") return json({});
      if (url.pathname === "/auth/v1/recover") {
        calls.push("recover");
        assert.equal(req.postDataJSON().email, user.email);
        assert.equal(url.searchParams.get("redirect_to"), new URL("/reset-password", base).href);
        return json({ code: "user_not_found", msg: "Synthetic provider error" }, 400);
      }
      if (url.pathname === "/auth/v1/verify") {
        calls.push("verify");
        const data = req.postDataJSON();
        assert.equal(data.type, "recovery");
        if (data.token_hash !== "valid-fixture" || used) return json({ code: "otp_expired", msg: "Synthetic expired link" }, 403);
        used = true;
        return json(session);
      }
      if (url.pathname === "/auth/v1/user" && req.method() === "PUT") {
        calls.push("update");
        assert.equal(req.headers().authorization, `Bearer ${session.access_token}`);
        password = req.postDataJSON().password;
        return json(user);
      }
      if (url.pathname === "/auth/v1/user") return json(user);
      if (url.pathname === "/auth/v1/logout") {
        calls.push("logout");
        assert.equal(url.searchParams.get("scope"), "global");
        return json({});
      }
      if (url.pathname === "/auth/v1/token") {
        if (url.searchParams.get("grant_type") === "pkce") {
          calls.push("legacy-code");
          assert.equal(req.postDataJSON().auth_code, "legacy-fixture");
          assert.equal(req.postDataJSON().code_verifier, "fixture-verifier");
          return json(session);
        }
        assert.equal(url.searchParams.get("grant_type"), "password");
        calls.push("login");
        return req.postDataJSON().password === password ? json(session) : json({ code: "invalid_credentials", msg: "Invalid login" }, 400);
      }
      return json([]);
    });

    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    page.on("pageerror", error => console.error("Fixture page error:", error.message));
    async function go(pathname) { return page.goto(new URL(pathname, base).href); }
    await go("/login");
    await page.getByLabel("Email", { exact: true }).fill(user.email);
    await page.getByRole("button", { name: "Forgot password?" }).click();
    await page.getByText("If there’s an account", { exact: false }).waitFor();
    await page.getByRole("button", { name: "Resend reset link" }).click();
    await page.getByText("Wait one minute", { exact: false }).waitFor();
    assert.deepEqual(calls, ["recover"]);

    const response = await go("/recover-password?token_hash=valid-fixture&type=recovery");
    assert.equal(response.status(), 200);
    assert.equal(response.headers()["referrer-policy"], "no-referrer");
    assert.match(response.headers()["cache-control"], /no-store/);
    const confirm = page.getByRole("button", { name: "Continue to reset password" });
    await confirm.waitFor();
    assert.equal(new URL(page.url()).search, "");
    assert.deepEqual(calls, ["recover"]);
    await confirm.click();
    const newPassword = page.getByLabel("New password", { exact: true });
    try {
      await newPassword.fill("updated fixture password");
    } catch (cause) {
      throw new Error(`Recovery form did not open. Auth calls: ${calls.join(", ")}. Visible status: ${await page.locator(".hc-auth-card").innerText()}`, { cause });
    }
    await page.getByLabel("Confirm new password").fill("different fixture password");
    await page.getByRole("button", { name: "Update Password" }).click();
    await page.getByText("Passwords do not match.").waitFor();
    await page.getByLabel("Confirm new password").fill("updated fixture password");
    await page.getByRole("button", { name: "Update Password" }).click();
    await page.getByText("Password updated. Sign in with your new password.").waitFor();
    assert.deepEqual(calls, ["recover", "verify", "update", "logout"]);
    assert.equal((await context.cookies()).some(cookie => /^sb-ci-auth-token(?:\.\d+)?$/.test(cookie.name)), false);

    // Seed a recovery verifier before an invalid alias code. The shared client
    // must not exchange it or create a normal login session.
    const verifierCookie = { name: "sb-ci-auth-token-code-verifier", value: `base64-${part("fixture-verifier/PASSWORD_RECOVERY")}`, url: base.origin };
    await context.addCookies([verifierCookie]);
    for (const query of ["token_hash=expired-fixture&type=recovery", "token_hash=valid-fixture&type=recovery", "token_hash=one&token_hash=two&type=recovery", "code=wrong-route"]) {
      await go(`/recover-password?${query}`);
      if (!query.includes("&token_hash=") && !query.startsWith("code=")) await confirm.click();
      await page.getByText("This recovery link is invalid", { exact: false }).waitFor();
      await page.getByRole("link", { name: "Request a new reset link" }).waitFor();
    }
    assert.deepEqual(calls.slice(4), ["verify", "verify"]);
    assert.equal((await context.cookies()).some(cookie => /^sb-ci-auth-token(?:\.\d+)?$/.test(cookie.name)), false);
    assert.equal((await context.cookies()).find(cookie => cookie.name === verifierCookie.name)?.value, verifierCookie.value,
      "The wrong recovery route must preserve the pending legacy verifier");

    // Use the same verifier for the valid legacy route.
    await page.getByRole("link", { name: "Back to sign in" }).click();
    await page.waitForURL("**/login");
    await page.getByLabel("Email", { exact: true }).waitFor();
    await go("/reset-password?code=legacy-fixture");
    try {
      await newPassword.waitFor({ timeout: 25_000 });
    } catch (cause) {
      throw new Error(`Legacy recovery did not open. Auth calls: ${calls.join(", ")}. Visible status: ${await page.locator(".hc-auth-card").innerText()}`, { cause });
    }
    assert.deepEqual(calls.slice(4), ["verify", "verify", "legacy-code"]);
    assert.equal(new URL(page.url()).search, "");
    assert.equal((await context.cookies()).some(cookie => /^sb-ci-auth-token(?:-code-verifier|\.\d+)?$/.test(cookie.name)), false);

    await go("/login");
    await page.getByLabel("Email", { exact: true }).fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill("original fixture password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByText("Invalid login").waitFor();
    await page.getByLabel("Password", { exact: true }).fill("updated fixture password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL("**/dashboard");
    assert.deepEqual(calls.slice(-2), ["login", "login"]);
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
  try {
    await run(browser);
    console.log("PASS: browser recovery, generic resend, password confirmation, global logout, invalid links and renewed login (mock Auth).");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
