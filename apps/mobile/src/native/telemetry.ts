import * as Sentry from "@sentry/react-native";
import { privateEvent } from "./telemetryPrivacy";

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN),
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
