import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { randomUUID } from "expo-crypto";
import { getItemAsync, setItemAsync, WHEN_UNLOCKED_THIS_DEVICE_ONLY } from "expo-secure-store";
import { supabase } from "../lib/supabase";
import { useNetwork } from "./network";
import { readChatPushPreference, syncChatPushDevice } from "./chatPush";
import { withAlertDeadline } from "./notifications";
import { createChatPushReceipts, reconcileChatPush } from "./chatPushLifecycle";

const accepted = process.env.EXPO_PUBLIC_HOOPCHECK_CHAT_PUSH_NATIVE_ENABLED === "true" &&
  process.env.EXPO_PUBLIC_HOOPCHECK_CHAT_PUSH_PROVIDER_ACCEPTED === "true";
const projectPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const installKey = "hoopcheck.chat-push.installation.v1";
let pendingInstallation: Promise<string> | null = null;
function installation() {
  pendingInstallation ??= (async () => {
    const existing = await getItemAsync(installKey);
    if (existing) return existing;
    const id = randomUUID();
    await setItemAsync(installKey, id, { keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    return id;
  })().finally(() => { pendingInstallation = null; });
  return pendingInstallation;
}

let suspendRegistration: (() => void) | null = null;
let refreshRegistration: ((prompt?: boolean) => void) | null = null;
export function refreshNativeChatPush(prompt = false) {
  refreshRegistration?.(prompt);
}
const subscribers = new Set<(owner: string) => void>();
export function subscribeChatPushRefresh(refresh: (owner: string) => void) {
  subscribers.add(refresh);
  return () => { subscribers.delete(refresh); };
}

export async function revokeNativeChatPushBeforeSignOut() {
  if (!accepted || Platform.OS === "web") return;
  suspendRegistration?.();
  await withAlertDeadline(async signal => {
    const id = await getItemAsync(installKey);
    const result = await supabase.auth.getSession();
    const owner = result.data.session?.user.id;
    if (id && owner && !result.error && !signal.aborted) await syncChatPushDevice(supabase, owner, id, null, signal);
  }).catch(() => {
    // Proceed with sign-out. The server also binds registrations to the live Auth session.
  });
}

export function NativeChatPush({ owner }: { owner: string | null }) {
  const router = useRouter();
  const { offline } = useNetwork();
  useEffect(() => {
    const platform = Platform.OS;
    if (!accepted || !owner || offline || (platform !== "ios" && platform !== "android")) return;
    const ownerId = owner;
    const controller = new AbortController();
    const scope = controller.signal;
    const received = createChatPushReceipts(), tapped = createChatPushReceipts();
    function bounded<T>(task: (signal: AbortSignal) => Promise<T>) {
      return withAlertDeadline(async timeout => {
        const local = new AbortController();
        const abort = () => local.abort();
        if (scope.aborted || timeout.aborted) abort();
        scope.addEventListener("abort", abort, { once: true });
        timeout.addEventListener("abort", abort, { once: true });
        try { return await task(local.signal); }
        finally {
          scope.removeEventListener("abort", abort);
          timeout.removeEventListener("abort", abort);
        }
      });
    }
    let dispose = () => {};
    let tail = Promise.resolve();

    // Loading is guarded for previously installed native binaries, which lack
    // notifications. A missing module leaves the app and in-app Alerts usable.
    void import("expo-notifications").then(async notifications => {
      if (scope.aborted) return;
      const projectId = Constants.easConfig?.projectId;
      if (!projectId || !projectPattern.test(projectId)) return;

      const isForeground = () => AppState.currentState === "active" || AppState.currentState === null;
      const sync = (prompt = false) => {
        tail = tail.catch(() => {}).then(() => bounded(async signal => {
          if (signal.aborted || !isForeground()) return;
          await reconcileChatPush({
            preference: s => readChatPushPreference(supabase, ownerId, null, s),
            permission: notifications.getPermissionsAsync,
            async requestPermission() {
              if (platform === "android") {
                await notifications.setNotificationChannelAsync("hoopchat", {
                  name: "HoopChat", importance: notifications.AndroidImportance.DEFAULT,
                });
              }
              if (signal.aborted) return { granted: false, canAskAgain: false };
              return notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: false } });
            },
            async token() {
              return (await notifications.getExpoPushTokenAsync({ projectId })).data;
            },
            async sync(token, s) {
              const id = await installation();
              if (!s.aborted) await syncChatPushDevice(supabase, ownerId, id, token ? { platform, token } : null, s);
            },
          }, prompt, signal);
        })).catch(() => {});
      };

      const receive = async (notice: import("expo-notifications").Notification, navigate: boolean) => {
        if (scope.aborted || !(navigate ? tapped : received)(notice.request.identifier, notice.request.content.data)) return;
        try {
          const permitted = await bounded(signal => readChatPushPreference(supabase, ownerId, null, signal));
          if (!permitted || scope.aborted) return;
          if (navigate) router.push({ pathname: "/notifications", params: { tab: "chat" } });
          else subscribers.forEach(refresh => refresh(ownerId));
        } catch { /* Revalidate from the inbox when network or identity is unavailable. */ }
      };

      const response = (reply: import("expo-notifications").NotificationResponse) => {
        void notifications.clearLastNotificationResponseAsync().catch(() => {});
        if (reply.actionIdentifier === notifications.DEFAULT_ACTION_IDENTIFIER) void receive(reply.notification, true);
      };
      const suspend = () => { controller.abort(); dispose(); };
      refreshRegistration = sync;
      suspendRegistration = suspend;
      const changes = AppState.addEventListener("change", state => { if (state === "active") sync(); });
      const token = notifications.addPushTokenListener(() => sync());
      const foreground = notifications.addNotificationReceivedListener(notice => { if (isForeground()) void receive(notice, false); });
      const taps = notifications.addNotificationResponseReceivedListener(response);
      dispose = () => {
        if (refreshRegistration === sync) refreshRegistration = null;
        if (suspendRegistration === suspend) suspendRegistration = null;
        changes.remove(); token.remove(); foreground.remove(); taps.remove();
      };
      sync();
      if (notifications.getLastNotificationResponse) {
        const last = notifications.getLastNotificationResponse();
        if (last && !scope.aborted) response(last);
      }
    }).catch(() => {});
    return () => { controller.abort(); dispose(); };
  }, [owner, offline, router]);
  return null;
}
