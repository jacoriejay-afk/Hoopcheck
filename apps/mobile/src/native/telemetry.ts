import * as Sentry from "@sentry/react-native";
import { nativeTelemetryDsn, privateEvent } from "./telemetryPrivacy";

const dsn = nativeTelemetryDsn(process.env.EXPO_PUBLIC_SENTRY_DSN);
Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  sendDefaultPii: false,
  enableAutoSessionTracking: true,
  enableAutoPerformanceTracing: false,
  enableCaptureFailedRequests: false,
  tracesSampleRate: 0.1,
  profilesSampleRate: 0,
  beforeBreadcrumb: () => null,
  beforeSend: event => privateEvent(event),
  beforeSendTransaction: event => privateEvent(event),
});

export function traceFlow<T>(name: "startup" | "directory" | "team" | "league" | "profile" | "posting" | "feed", task: () => Promise<T>) {
  return Sentry.startSpan({ name, op: "app.flow", attributes: {} }, task);
}
export { Sentry };
