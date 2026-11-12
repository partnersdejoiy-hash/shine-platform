/**
 * Joi reading someone's own chats: the "grant" Shine gives that person's Joi panel.
 *
 * It is signed with a key only this Shine server knows (derived from the auth signing key that is
 * already set here), so the Joi server cannot make one up for someone else even though it holds
 * the shared JOI_APP_SECRET. It names one person and their sign-in session; signing out of Shine
 * ends the session, and with it the grant.
 */

export type JoiGrant = { app: "shine"; k: "grant"; u: string; s: string; e: string; exp: number };

export const GRANT_HOURS = 12;

const enc = new TextEncoder();
const b64u = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

async function hmacKey(secret: string | ArrayBuffer, use: "sign" | "verify") {
  return await crypto.subtle.importKey("raw", typeof secret === "string" ? enc.encode(secret) : secret, { name: "HMAC", hash: "SHA-256" }, false, [use]);
}

/** A key of its own for grants, made from a secret only this server holds. */
export async function deriveGrantKey(serverSecret: string): Promise<ArrayBuffer> {
  const key = await hmacKey(serverSecret, "sign");
  return await crypto.subtle.sign("HMAC", key, enc.encode("shine-joi-grant-v1"));
}

export async function signGrant(key: ArrayBuffer, claims: Omit<JoiGrant, "app" | "k">): Promise<string> {
  const body = b64u(enc.encode(JSON.stringify({ app: "shine", k: "grant", ...claims })));
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(key, "sign"), enc.encode(body)));
  return `${body}.${b64u(mac)}`;
}

/** The grant's claims if it is ours, whole and not expired; otherwise null. */
export async function readGrant(key: ArrayBuffer, token: unknown, now = Date.now()): Promise<JoiGrant | null> {
  if (typeof token !== "string" || token.length > 2000 || token.split(".").length !== 2) return null;
  const [body, mac] = token.split(".");
  try {
    if (!(await crypto.subtle.verify("HMAC", await hmacKey(key, "verify"), fromB64u(mac), enc.encode(body)))) return null;
    const c = JSON.parse(new TextDecoder().decode(fromB64u(body))) as Partial<JoiGrant>;
    if (c.app !== "shine" || c.k !== "grant" || typeof c.u !== "string" || typeof c.s !== "string" || typeof c.e !== "string") return null;
    if (typeof c.exp !== "number" || !(now < c.exp && c.exp <= now + GRANT_HOURS * 3_600_000 + 60_000)) return null;
    return c as JoiGrant;
  } catch {
    return null;
  }
}

/**
 * Joi's own request signature (Bearer, signed with JOI_APP_SECRET): for reading chats it must be
 * fresh, at most 2 minutes, so a copied request soon stops working.
 */
export async function readFreshJoiToken(secret: string | undefined, token: string, now = Date.now()): Promise<boolean> {
  if (!secret || token.split(".").length !== 2) return false;
  const [body, mac] = token.split(".");
  try {
    if (!(await crypto.subtle.verify("HMAC", await hmacKey(secret, "verify"), fromB64u(mac), enc.encode(body)))) return false;
    const p = JSON.parse(new TextDecoder().decode(fromB64u(body))) as { app?: string; exp?: number };
    return p.app === "shine" && typeof p.exp === "number" && now < p.exp && p.exp <= now + 120_000;
  } catch {
    return false;
  }
}
