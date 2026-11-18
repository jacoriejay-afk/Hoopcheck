export type AuthIntentStore = { read: () => string; write: (value: string) => void };
export function createAuthIntents(store?: AuthIntentStore) {
  let local = "initial";
  function read() { return store?.read() || local; }
  return { read, begin() { local = `${Date.now()}:${Math.random().toString(36).slice(2)}`; store?.write(local); return read(); } };
}
function subject(token: string | null) {
  try { return JSON.parse(atob((token?.replace(/^Bearer\s+/i, "") ?? "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub; } catch { return null; }
}
export function guardAuthResponses(project: string, intents: ReturnType<typeof createAuthIntents>, request: typeof fetch = fetch): typeof fetch {
  const origin = new URL(project).origin;
  return async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const authRequest = url.origin === origin && url.pathname.startsWith("/auth/v1/");
    const guarded = url.origin === origin && (url.pathname === "/auth/v1/token" || url.pathname === "/auth/v1/signup" || /^\/auth\/v1\/factors\/[0-9a-f-]{36}\/verify$/i.test(url.pathname));
    const intent = intents.read();
    const controller = new AbortController();
    const upstream = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const abort = () => controller.abort();
    if (upstream?.aborted) controller.abort();
    upstream?.addEventListener("abort", abort, { once: true });
    const deadline = authRequest ? setTimeout(abort, 20000) : undefined;
    try {
      const response = await request(input, authRequest ? { ...init, signal: controller.signal } : init);
      // Consume a clone while the deadline still covers the response body.
      // The SDK retains the original response and its normal error handling.
      const result = authRequest ? await response.clone().json().catch(() => null) : null;
      if (!guarded || !response.ok) return response;
      // This is a denial-only concurrency check, never JWT authorization. It
      // prevents a delayed Auth response from overwriting a newer sign-in/out.
      if (intent !== intents.read()) return new Response(JSON.stringify({ error: "auth_intent_changed", msg: "Your account changed. Please sign in again." }), { status: 409, headers: { "Content-Type": "application/json" } });
      if (url.pathname.includes("/factors/")) {
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        const owner = subject(headers.get("authorization"));
        if (!owner || result?.user?.id !== owner || subject(result.access_token) !== owner) return new Response(JSON.stringify({ error: "auth_identity_mismatch", msg: "Account verification could not be confirmed." }), { status: 409, headers: { "Content-Type": "application/json" } });
      }
      return response;
    } finally { clearTimeout(deadline); upstream?.removeEventListener("abort", abort); }

  };
}
export function bindAuthIntents<T extends { signInWithPassword: (...args: never[]) => unknown; signUp: (...args: never[]) => unknown; signOut: (...args: never[]) => unknown; setSession: (...args: never[]) => unknown; exchangeCodeForSession: (...args: never[]) => unknown }>(auth: T, intents: ReturnType<typeof createAuthIntents>) {
  for (const name of ["signInWithPassword", "signUp", "signOut", "setSession", "exchangeCodeForSession"] as const) {
    const original = auth[name].bind(auth);
    auth[name] = ((...args: never[]) => { intents.begin(); return original(...args); }) as T[typeof name];
  }
}
