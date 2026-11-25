export type ServiceObservation = { status: "reachable" | "maintenance_announced"; observedAt: string };

export async function readServiceObservation(origin: string, request: typeof fetch = fetch, signal?: AbortSignal): Promise<ServiceObservation> {
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Invalid service configuration");
  url.pathname = "/api/service-status";
  if (signal?.aborted) throw new Error("Service check cancelled");
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel: (() => void) | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await request(url.toString(), { method: "GET", headers: { Accept: "application/json" }, cache: "no-store", redirect: "error", signal: controller.signal });
        if (!response.ok) throw new Error("Service check unavailable");
        const value: unknown = await response.json();
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid service observation");
        const record = value as Record<string, unknown>;
        if (record.version !== 1 || (record.status !== "reachable" && record.status !== "maintenance_announced") || typeof record.observedAt !== "string") throw new Error("Invalid service observation");
        const time = Date.parse(record.observedAt);
        if (!Number.isFinite(time) || Math.abs(Date.now() - time) > 120000) throw new Error("Service observation is stale");
        if (controller.signal.aborted) throw new Error("Service check cancelled");
        return { status: record.status, observedAt: record.observedAt } as ServiceObservation;
      })(),
      new Promise<never>((_, reject) => {
        cancel = () => reject(new Error("Service check cancelled"));
        controller.signal.addEventListener("abort", cancel, { once: true });
        if (controller.signal.aborted) cancel();
        timer = setTimeout(() => controller.abort(), 8000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    if (cancel) controller.signal.removeEventListener("abort", cancel);
    signal?.removeEventListener("abort", onAbort);
  }
}
