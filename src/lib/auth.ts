/** Single-user session: HMAC-SHA256 signed cookie (Web Crypto, compatible with Edge middleware). */
export const SESSION_COOKIE = "mp_session";
const enc = new TextEncoder();

async function hmac(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function authEnabled() {
  return !!process.env.APP_PASSWORD;
}

function secret() {
  return process.env.SESSION_SECRET || process.env.APP_PASSWORD || "dev-secret";
}

export async function createSessionToken(days = 30): Promise<string> {
  const exp = Date.now() + days * 86400_000;
  return `${exp}.${await hmac(String(exp), secret())}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = await hmac(exp, secret());
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
