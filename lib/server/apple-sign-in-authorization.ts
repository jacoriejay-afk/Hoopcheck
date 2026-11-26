// Server-only candidate. Never import this into a client bundle or log credentials.
import { createCipheriv, createDecipheriv, createHash, createPrivateKey, createPublicKey, randomBytes, sign, verify, type JsonWebKey } from "node:crypto";

const APPLE = "https://appleid.apple.com";
const CLIENT_ID = "online.hoopcheck.app";
type AppleConfig = { teamId: string; keyId: string; privateKey: string };
type TokenClaims = { sub: string; nonce?: string; iss: string; aud: string; exp: number; iat: number };
const encoded = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const parse = (part: string): Record<string, unknown> => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
function checkedSecret(config: AppleConfig, now: number) {
  if (!/^[A-Z0-9]{10}$/.test(config.teamId) || !/^[A-Z0-9]{10}$/.test(config.keyId)) throw Error("Apple authentication is not configured.");
  const key = createPrivateKey(config.privateKey);
  if (key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1") throw Error("Invalid Apple authentication signing key.");
  const unsigned = encoded({ alg: "ES256", kid: config.keyId }) + "." + encoded({ iss: config.teamId, iat: now, exp: now + 300, aud: APPLE, sub: CLIENT_ID });
  return unsigned + "." + sign("sha256", Buffer.from(unsigned), { key, dsaEncoding: "ieee-p1363" }).toString("base64url");
}
export function verifyAppleIdentity(token: string, keys: JsonWebKey[], expectedSubject: string, hashedNonce: string | undefined, now = Math.floor(Date.now() / 1000)): TokenClaims {
  if (!token || token.length > 16000 || !expectedSubject) throw Error("Invalid Apple identity.");
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) throw Error("Invalid Apple identity.");
  const [head, payload, signature] = parts;
  const header = parse(head);
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw Error("Invalid Apple identity signature.");
  const jwk = keys.find(key => key.kid === header.kid && key.kty === "RSA" && (!key.alg || key.alg === "RS256") && (!key.use || key.use === "sig"));
  if (!jwk || !verify("RSA-SHA256", Buffer.from(head + "." + payload), createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(signature, "base64url"))) throw Error("Invalid Apple identity signature.");
  const claims = parse(payload);
  if (claims.iss !== APPLE || claims.aud !== CLIENT_ID || claims.sub !== expectedSubject ||
      typeof claims.exp !== "number" || claims.exp <= now || typeof claims.iat !== "number" || claims.iat > now + 30 || claims.iat < now - 600 ||
      (hashedNonce !== undefined && claims.nonce !== hashedNonce)) throw Error("Apple identity does not match this account.");
  return claims as TokenClaims;
}

async function postApple(path: "/auth/token" | "/auth/revoke", values: Record<string, string>, config: AppleConfig, request: typeof fetch) {
  const now = Math.floor(Date.now() / 1000);
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const response = await request(APPLE + path, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: checkedSecret(config, now), ...values }), redirect: "error", cache: "no-store", signal: ctrl.signal });
    if (!response.ok) throw Error("Apple authentication request was not confirmed.");
    if (path === "/auth/revoke") return null;
    const result: unknown = await response.json();
    if (!result || typeof result !== "object") throw Error("Invalid Apple token response.");
    return result as Record<string, unknown>;
  } finally { clearTimeout(timer); }
}

// Caller must establish the owner and Apple subject using Auth.getUser on
// the exact bearer token and verified provider identity, never email matching.
export async function exchangeAppleAuthorization(input: { code: string; identityToken: string; rawNonce: string; subject: string }, keys: JsonWebKey[], config: AppleConfig, request: typeof fetch = fetch) {
  if (!/^[a-f0-9]{64}$/.test(input.rawNonce) || !input.code || input.code.length > 4096) throw Error("Invalid Apple authorization.");
  const nonce = createHash("sha256").update(input.rawNonce).digest("hex");
  verifyAppleIdentity(input.identityToken, keys, input.subject, nonce);
  const tokens = await postApple("/auth/token", { code: input.code, grant_type: "authorization_code" }, config, request);
  if (!tokens || typeof tokens.id_token !== "string" || typeof tokens.refresh_token !== "string" || !tokens.refresh_token || tokens.refresh_token.length > 8192)
    throw Error("Apple authorization could not be stored.");
  // The original credential must include the nonce. Independently verify the
  // code exchange token against the exact same provider subject and audience.
  const claims = verifyAppleIdentity(tokens.id_token, keys, input.subject, undefined);
  if (claims.nonce !== undefined && claims.nonce !== nonce) throw Error("Apple authorization nonce mismatch.");
  return tokens.refresh_token;
}

function keyBytes(base64: string) {
  const key = Buffer.from(base64, "base64");
  if (key.length !== 32) throw Error("Invalid Apple token vault key.");
  return key;
}
const aad = (owner: string, subject: string) => Buffer.from(JSON.stringify(["hoopcheck-apple-v1", owner, subject, CLIENT_ID]));
export function encryptAppleToken(token: string, owner: string, subject: string, encryptionKey: string) {
  if (!owner || !subject || !token || token.length > 8192) throw Error("Invalid Apple token.");
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", keyBytes(encryptionKey), iv);
  cipher.setAAD(aad(owner, subject));
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}
export function decryptAppleToken(envelope: string, owner: string, subject: string, encryptionKey: string) {
  const parts = envelope.split(".");
  if (parts.length !== 4 || parts[0] !== "v1" || envelope.length > 12000) throw Error("Invalid Apple token envelope.");
  const [_, iv, tag, encrypted] = parts;
  const ivBytes = Buffer.from(iv, "base64url"), tagBytes = Buffer.from(tag, "base64url");
  if (ivBytes.length !== 12 || tagBytes.length !== 16) throw Error("Invalid Apple token envelope.");
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(encryptionKey), ivBytes);
  decipher.setAAD(aad(owner, subject)); decipher.setAuthTag(tagBytes);
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}
export async function revokeAppleAuthorization(encrypted: string, owner: string, subject: string, encryptionKey: string, config: AppleConfig, request: typeof fetch = fetch) {
  const token = decryptAppleToken(encrypted, owner, subject, encryptionKey);
  // An acknowledged Apple response is the only success. Retain encrypted
  // credentials for retry on transport failures; never log or return them.
  await postApple("/auth/revoke", { token, token_type_hint: "refresh_token" }, config, request);
}
