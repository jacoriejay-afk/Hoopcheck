const flows = new Set(["startup", "directory", "team", "league", "profile", "posting", "feed"]);
const id = (value: unknown) => typeof value === "string" && /^[a-f0-9-]{16,40}$/i.test(value) ? value : undefined;
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : undefined;
const record = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const records = (value: unknown, limit: number) =>
  Array.isArray(value) ? value.slice(0, limit).flatMap(item => { const row = record(item); return row ? [row] : []; }) : [];

export function nativeTelemetryDsn(value: unknown) {
  if (typeof value !== "string" || value.length > 512 || value.trim() !== value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !/^[A-Za-z0-9]{8,128}$/.test(url.username) ||
      url.password || url.search || url.hash || !/^(?:\/[A-Za-z0-9._-]+)*\/[0-9]+\/?$/.test(url.pathname)) return undefined;
    return value;
  } catch {
    return undefined;
  }
}

function bundledLocation(value: unknown) {
  if (typeof value !== "string") return undefined;
  const path = value.split("?")[0].replace(/^https?:\/\/[^/]+/, "");
  return /^(?:app:\/\/\/|\/)?(?:index(?:\.(?:android|ios))?\.bundle|main\.jsbundle)$/.test(path) || /^\/_expo\/static\/js\/(?:ios|android|web)\/entry-[a-f0-9]+\.js$/.test(path) ? path : undefined;
}

// Rebuild events from an allowlist. Scrubbing only familiar sensitive field names
// misses review/message content nested in arbitrary integration data.
export function privateEvent<T extends object>(input: T): T {
  const event = input as Record<string, unknown>;
  const trace = record(record(event.contexts)?.trace);
  const exception = record(event.exception);
  const debug = record(event.debug_meta);
  const safe = {
    event_id: id(event.event_id), timestamp: number(event.timestamp), start_timestamp: number(event.start_timestamp),
    platform: "javascript", level: event.level === "fatal" ? "fatal" : "error",
    release: typeof event.release === "string" && /^online\.hoopcheck\.app@\d+\.\d+\.\d+(?:\+\d+)?$/.test(event.release) ? event.release : undefined,
    dist: typeof event.dist === "string" && /^\d+$/.test(event.dist) ? event.dist : undefined,
    type: event.type === "transaction" ? "transaction" : undefined,
    transaction: typeof event.transaction === "string" && flows.has(event.transaction) ? event.transaction : undefined,
    contexts: trace ? { trace: { trace_id: id(trace.trace_id), span_id: id(trace.span_id), op: "app.flow" } } : undefined,
    exception: exception ? { values: records(exception.values, 8).map(value => ({
      type: "Error", value: "App error — content redacted",
      stacktrace: { frames: records(record(value.stacktrace)?.frames, 100).map(frame => ({
        // Retain only bundled source locations needed by source-map symbolication.
        filename: bundledLocation(frame.filename),
        lineno: number(frame.lineno), colno: number(frame.colno), in_app: frame.in_app === true,
      })) },
    })) } : undefined,
    // Raw span descriptions/data, breadcrumbs, requests, user context, logs,
    // attachments and arbitrary extras are deliberately never forwarded.
    spans: event.type === "transaction" ? [] : undefined,
    debug_meta: debug ? { images: records(debug.images, 32).filter(image => image.type === "sourcemap" && id(image.debug_id)).map(image => ({ type: "sourcemap", debug_id: id(image.debug_id) })) } : undefined,
  };
  return safe as T;
}
