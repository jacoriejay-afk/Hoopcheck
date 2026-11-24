// Shared across web/native without importing either platform's SDK/runtime.
type Result<T> = { data: T | null; error: { message: string; code?: string } | null };
type OwnProfileClient<T> = {
  auth: { getSession(): Promise<{ data: { session: { user: { id: string }; access_token: string } | null }; error?: unknown }> };
  rpc(name: "get_own_profile"): PromiseLike<Result<T>> & {
    setHeader(name: string, value: string): { abortSignal(signal: AbortSignal): PromiseLike<Result<T>> };
  };
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The database chooses the caller from the JWT; there is no target-ID input.
 * Freeze that JWT so an account switch cannot redirect an in-flight read. */
export async function getOwnProfile<T>(client: OwnProfileClient<T>, owner: string, compatibility?: { origin: string; request?: typeof fetch }): Promise<Result<T>> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const work = async (): Promise<Result<T>> => {
      if (!uuid.test(owner)) throw new Error("Your profile owner could not be verified.");
      const session = await client.auth.getSession();
      if (session.error || session.data.session?.user.id !== owner) throw new Error("Your account changed. Sign in again.");
      const token = session.data.session.access_token;
      let result = await client.rpc("get_own_profile").setHeader("Authorization", `Bearer ${token}`).abortSignal(controller.signal);
      // Only an absent RPC permits the independently authenticated server
      // bridge. Permission, MFA and network errors must never fall back.
      if (result.error?.code === "PGRST202" && compatibility) {
        const base = new URL(compatibility.origin);
        if (base.protocol !== "https:" || base.username || base.password || base.pathname !== "/" || base.search || base.hash) throw new Error("Invalid profile service.");
        const before = await client.auth.getSession();
        if (before.error || before.data.session?.user.id !== owner || before.data.session.access_token !== token) throw new Error("Your account changed. Refresh your profile.");
        const response = await (compatibility.request ?? fetch)(new URL("/api/mobile/own-profile", base).toString(), { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", redirect: "error", signal: controller.signal });
        const payload = await response.json();
        if (!response.ok || payload?.owner !== owner || !payload.profile || typeof payload.profile !== "object" || Array.isArray(payload.profile)) throw new Error("Your profile could not be verified. Try again.");
        result = { data: payload.profile as T, error: null };
      }
      if (result.error) return { data: null, error: result.error };
      const current = await client.auth.getSession();
      if (current.error || current.data.session?.user.id !== owner || current.data.session.access_token !== token) throw new Error("Your account changed. Refresh your profile.");
      if (!result.data || typeof result.data !== "object" || !("id" in result.data) || result.data.id !== owner) throw new Error("Your profile could not be verified. Try again.");
      return result;
    };
    return await Promise.race([work(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error("Your profile did not finish loading. Try again.")); }, 15000);
    })]);
  } catch (error) {
    return { data: null, error: { message: error instanceof Error ? error.message : "Your profile could not be loaded." } };
  } finally { clearTimeout(timer); }
}
