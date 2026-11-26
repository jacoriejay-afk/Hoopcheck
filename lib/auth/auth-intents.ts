export type AuthIntentStore = { read: () => string; write: (value: string) => void };
export function browserAuthIntentStore(project: string): AuthIntentStore | undefined {
  if (typeof document === "undefined") return undefined;
  const key = `hoopcheck-auth-intent-${new URL(project).hostname.split(".")[0]}`;
  return {
    read: () => document.cookie.split("; ").find(cookie => cookie.startsWith(`${key}=`))?.slice(key.length + 1) || "",
    write: value => { document.cookie = `${key}=${value}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`; },
  };
}
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
    const guarded = url.origin === origin && (url.pathname === "/auth/v1/token" || url.pathname === "/auth/v1/signup" || url.pathname === "/auth/v1/verify" || url.pathname === "/auth/v1/logout" || (url.pathname === "/auth/v1/user" && /^(PUT|PATCH)$/i.test(init?.method ?? (input instanceof Request ? input.method : "GET"))) || /^\/auth\/v1\/factors\/[0-9a-f-]{36}\/verify$/i.test(url.pathname));
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
type Exclusive = (work: () => Promise<unknown>) => Promise<unknown>;
export function browserAuthActionLock(project: string): Exclusive | undefined {
  if (typeof navigator === "undefined" || !navigator.locks?.request) return undefined;
  const name = `hoopcheck-auth-actions:${new URL(project).hostname}`;
  return work => navigator.locks.request(name, { mode: "exclusive" }, work);
}
export function bindAuthIntents<T extends { signInWithPassword: (...args: never[]) => unknown; signUp: (...args: never[]) => unknown; signOut: (...args: never[]) => unknown; setSession: (...args: never[]) => unknown; exchangeCodeForSession: (...args: never[]) => unknown }>(auth: T, intents: ReturnType<typeof createAuthIntents>, exclusive?: Exclusive) {
  const marker = Symbol.for("hoopcheck.auth-intents-bound");
  const client = auth as unknown as Record<string | symbol, unknown>;
  if (client[marker]) return;
  Object.defineProperty(client, marker, { value: true });
  let queue: Promise<unknown> = Promise.resolve();
  const stale = () => ({ data: { user: null, session: null, url: null }, error: new Error("Your account changed. Please sign in again.") });
  function enqueue(intent: string, action: () => Promise<unknown>) {
    const work = async () => {
      if (intent !== intents.read()) return stale();
      const result = await action();
      return intent === intents.read() ? result : stale();
    };
    const result = queue.catch(() => {}).then(() => exclusive ? exclusive(work) : work());
    queue = result.catch(() => {});
    return result;
  }
  // MFA management must retain the UI's verified owner even if another sign-in
  // is already queued. Inspect identity inside the same operation queue.
  const mfa = client.mfa as Record<string, unknown> | undefined;
  const originals = new Map<string, (...args: unknown[]) => Promise<unknown>>();
  if (mfa) for (const name of ["enroll", "unenroll", "challengeAndVerify"]) {
    if (typeof mfa[name] === "function") originals.set(name, (mfa[name] as (...args: unknown[]) => Promise<unknown>).bind(mfa));
  }
  Object.defineProperty(client, Symbol.for("hoopcheck.owned-mfa"), { value: (owner: string, name: string, args: unknown[]) => enqueue(intents.read(), async () => {
    const session = await (client.getSession as () => Promise<{ data: { session: { user: { id: string } } | null }; error: unknown }>).call(auth);
    if (session.error || session.data.session?.user.id !== owner || !originals.has(name)) return stale();
    return originals.get(name)!(...args);
  }) });
  function bind(target: Record<string, unknown>, name: string, startsIntent: boolean) {
    const original = target[name];
    if (typeof original !== "function") return;
    target[name] = (...args: unknown[]) => {
      const intent = startsIntent ? intents.begin() : intents.read();
      return enqueue(intent, () => original.apply(target, args));
    };
  }
  for (const name of ["signInWithPassword", "signUp", "signOut", "setSession", "exchangeCodeForSession", "verifyOtp", "signInWithOAuth"]) bind(client, name, true);
  bind(client, "updateUser", false);
  if (client.mfa && typeof client.mfa === "object") for (const name of ["verify", "challengeAndVerify"]) bind(client.mfa as Record<string, unknown>, name, false);
}
