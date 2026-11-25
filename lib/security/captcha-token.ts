// Only the provider and Supabase can authenticate a CAPTCHA response.
export function createCaptchaTokenStore(enabled: boolean, now: () => number = Date.now) {
  let generation = 0;
  let value = "";
  let issuedAt = 0;
  const maxAgeMs = 290_000;
  return {
    accept(revision: number, token: string) {
      if (!enabled || revision !== generation) return false;
      value = typeof token === "string" && token.length <= 2048 ? token.trim() : "";
      issuedAt = now();
      return Boolean(value);
    },
    take() {
      if (!enabled) return { token: undefined, revision: generation };
      const token = value;
      const age = now() - issuedAt;
      value = "";
      issuedAt = 0;
      generation++;
      return { token: token && age >= 0 && age < maxAgeMs ? token : undefined, revision: generation };
    },
  };
}
