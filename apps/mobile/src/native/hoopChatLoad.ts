/**
 * HoopChat's request lifecycle must settle even when Auth or PostgREST stalls.
 * The deadline is local UI safety, never permission to bypass contact RLS.
 */
export async function withHoopChatDeadline<T>(
  task: (signal: AbortSignal) => Promise<T>,
  timeoutMs = 12000,
): Promise<T> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new Error("Invalid conversation timeout.");
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error("Conversations are taking too long. Tap Refresh to retry."));
        controller.abort();
      }, timeoutMs);
    });
    return await Promise.race([Promise.resolve().then(() => task(controller.signal)), deadline]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    controller.abort();
  }
}

export type HoopChatAuthAction = "ignore" | "clear" | "reload";

/** Token refresh, initial session, and metadata changes must not cancel a load. */
export function hoopChatAuthAction(
  event: string,
  knownUserId: string | null,
  nextUserId: string | null,
): HoopChatAuthAction {
  if (event === "SIGNED_OUT") return "clear";
  if (event === "SIGNED_IN" && nextUserId && nextUserId !== knownUserId) return "reload";
  return "ignore";
}
