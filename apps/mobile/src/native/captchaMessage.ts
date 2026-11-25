export const NATIVE_CAPTCHA_URL = "https://hoopcheck.online/auth/native-captcha";
export type NativeCaptchaMessage = { status: "token"; token: string } | { status: "expired" | "error" };
export function parseNativeCaptchaMessage(url: string, raw: string): NativeCaptchaMessage | null {
  if (url !== NATIVE_CAPTCHA_URL || typeof raw !== "string" || raw.length > 3000) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const data = value as Record<string, unknown>;
    if (data.type !== "hoopcheck-captcha" || data.version !== 1) return null;
    const keys = Object.keys(data);
    if (data.status === "token") {
      if (keys.length !== 4 || typeof data.token !== "string" || !data.token || data.token.length > 2048 || /\s/.test(data.token)) return null;
      return { status: "token", token: data.token };
    }
    if (keys.length === 3 && (data.status === "expired" || data.status === "error")) return { status: data.status };
    return null;
  } catch { return null; }
}
// This checks the message envelope, not CAPTCHA validity. Supabase Auth must
// still validate and consume the provider token. Never persist or log it.
