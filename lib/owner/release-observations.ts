/** Aggregate-only release comparison. Never accepts individual telemetry or user identifiers. */
export const releaseMetricNames = ["startup_failure", "request_failure", "signup_completion", "first_week_activation"] as const;
type Metric = typeof releaseMetricNames[number];
type Counts = { numerator: number; denominator: number };
type Snapshot = { sha: string; build: string; platform: "ios" | "android" | "web"; source: string; coverage: string; windowStart: string; windowEnd: string; metrics: Partial<Record<Metric, Counts>> };
type Observation = { baseline: Snapshot; candidate: Snapshot };
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const only = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every(k => keys.includes(k));
const safeLabel = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9 ._-]{0,79}$/.test(value);
const date = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
function parseSnapshot(value: unknown): Snapshot | null {
  if (!object(value) || !only(value, ["sha","build","platform","source","coverage","windowStart","windowEnd","metrics"]) ||
      typeof value.sha !== "string" || !/^[a-f0-9]{40}$/.test(value.sha) || !safeLabel(value.build) ||
      (value.platform !== "ios" && value.platform !== "android" && value.platform !== "web") ||
      !safeLabel(value.source) || !safeLabel(value.coverage) || !date(value.windowStart) || !date(value.windowEnd) ||
      Date.parse(value.windowEnd) <= Date.parse(value.windowStart) || !object(value.metrics) || !only(value.metrics, [...releaseMetricNames])) return null;
  const metrics: Snapshot["metrics"] = {};
  for (const metric of releaseMetricNames) {
    const c = value.metrics[metric];
    if (c === undefined) continue;
    if (!object(c) || !only(c, ["numerator","denominator"]) || typeof c.numerator !== "number" || typeof c.denominator !== "number" ||
        !Number.isSafeInteger(c.numerator) || !Number.isSafeInteger(c.denominator) || c.numerator < 0 || c.denominator < 0 || c.numerator > c.denominator) return null;
    metrics[metric] = {numerator:c.numerator, denominator:c.denominator};
  }
  return {sha:value.sha,build:value.build,platform:value.platform,source:value.source,coverage:value.coverage,windowStart:value.windowStart,windowEnd:value.windowEnd,metrics};
}
export function parseReleaseObservation(raw: string | undefined): Observation | null {
  if (!raw || raw.length > 16000) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!object(value) || !only(value, ["baseline","candidate"])) return null;
    const baseline = parseSnapshot(value.baseline), candidate = parseSnapshot(value.candidate);
    if (!baseline || !candidate || baseline.sha === candidate.sha || baseline.platform !== candidate.platform ||
        baseline.source !== candidate.source || baseline.coverage !== candidate.coverage ||
        Date.parse(baseline.windowEnd) > Date.parse(candidate.windowStart) ||
        Date.parse(baseline.windowEnd)-Date.parse(baseline.windowStart) !== Date.parse(candidate.windowEnd)-Date.parse(candidate.windowStart)) return null;
    return {baseline,candidate};
  } catch { return null; }
}
export function compareReleaseObservations(observation: Observation, now = Date.now()) {
  const {baseline,candidate} = observation;
  // Closed, recent measurement windows only. Alerts are review signals, not significance tests.
  const validWindow = Number.isFinite(now) && Date.parse(candidate.windowEnd) <= now && now - Date.parse(candidate.windowEnd) <= 7*86400000;
  return releaseMetricNames.map(metric => {
    const a=baseline.metrics[metric], b=candidate.metrics[metric];
    if (!validWindow || !a || !b || a.denominator < 100 || b.denominator < 100) return {metric,state:"unavailable" as const};
    const baselineRate=a.numerator/a.denominator, candidateRate=b.numerator/b.denominator;
    const changePoints=100*(candidateRate-baselineRate);
    const loss = metric.endsWith("failure") ? changePoints : -changePoints;
    return {metric,state:loss >= 2-1e-9 ? "review" as const : "no_threshold_breach" as const,baselineRate,candidateRate,changePoints,baselineCount:a.denominator,candidateCount:b.denominator};
  });
}
