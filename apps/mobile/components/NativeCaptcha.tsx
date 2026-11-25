import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, SafeAreaView, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { NATIVE_CAPTCHA_URL, parseNativeCaptchaMessage } from "../src/native/captchaMessage";

const enabled = process.env.EXPO_PUBLIC_AUTH_CAPTCHA_ENABLED === "true";
type Attempt = { id: number; resolve: (token: string) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };

export function useNativeCaptcha() {
  const [visibleId, setVisibleId] = useState<number | null>(null);
  const active = useRef<Attempt | null>(null);
  const serial = useRef(0);
  const finish = useCallback((id: number, token?: string) => {
    const attempt = active.current;
    if (!attempt || attempt.id !== id) return;
    active.current = null;
    clearTimeout(attempt.timer);
    setVisibleId(null);
    if (token) attempt.resolve(token);
    else attempt.reject(new Error("Security verification cancelled or unavailable. Please try again."));
  }, []);
  useEffect(() => () => {
    const attempt = active.current;
    active.current = null;
    if (attempt) {
      clearTimeout(attempt.timer);
      attempt.reject(new Error("Security verification cancelled."));
    }
  }, []);
  const requestToken = useCallback(async (): Promise<string | undefined> => {
    if (!enabled) return undefined;
    if (active.current) throw new Error("A security check is already in progress.");
    const id = ++serial.current;
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => finish(id), 280000);
      active.current = { id, resolve, reject, timer };
      setVisibleId(id);
    });
  }, [finish]);
  const challenge = visibleId === null ? null : (
    <Modal visible animationType="slide" onRequestClose={() => finish(visibleId)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#111111" }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 }}>
          <Text accessibilityRole="header" style={{ color: "#ffffff", fontSize: 18, fontWeight: "700" }}>Security check</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel security check" onPress={() => finish(visibleId)} style={{ padding: 12 }}>
            <Text style={{ color: "#ffffff" }}>Cancel</Text>
          </Pressable>
        </View>
        <WebView key={visibleId} source={{ uri: NATIVE_CAPTCHA_URL }}
          originWhitelist={["*"]}
          javaScriptEnabled domStorageEnabled
          allowFileAccess={false} allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false}
          mixedContentMode="never" sharedCookiesEnabled={false} setSupportMultipleWindows
          javaScriptCanOpenWindowsAutomatically={false}
          onOpenWindow={() => finish(visibleId)}
          onShouldStartLoadWithRequest={request => {
            if (request.url === NATIVE_CAPTCHA_URL) return true;
            if (request.isTopFrame === false) {
              if (request.url === "about:blank" || request.url === "about:srcdoc") return true;
              try { return new URL(request.url).origin === "https://challenges.cloudflare.com"; } catch { return false; }
            }
            return false;
          }}
          onNavigationStateChange={navigation => {
            if (navigation.url !== NATIVE_CAPTCHA_URL && navigation.url !== "about:blank") finish(visibleId);
          }}
          onMessage={event => {
            if (active.current?.id !== visibleId) return;
            const message = parseNativeCaptchaMessage(event.nativeEvent.url, event.nativeEvent.data);
            if (!message) return;
            finish(visibleId, message.status === "token" ? message.token : undefined);
          }}
          onError={() => finish(visibleId)}
          onHttpError={event => { if (event.nativeEvent.url === NATIVE_CAPTCHA_URL) finish(visibleId); }}
          onContentProcessDidTerminate={() => finish(visibleId)}
          onRenderProcessGone={() => finish(visibleId)}
        />
      </SafeAreaView>
    </Modal>
  );
  return { requestToken, challenge };
}
