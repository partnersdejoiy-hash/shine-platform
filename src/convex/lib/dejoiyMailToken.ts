import { ConvexError } from "convex/values";
// Sign-in tokens minted by Dejoiy Mail (mail.dejoiy.com) for its signed-in users.
// Format: base64url(JSON {e: email, n: name, a: admin level, p: photo URL, x: expiry ms, d: nonce}) + "." + base64url(HMAC-SHA256).
// The secret is shared with Dejoiy Mail (SHINE_SSO_SECRET there, DEJOIY_MAIL_SSO_SECRET here).
// No imports, so the same file runs in Convex and in plain Node for the tests.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function bytes(b64url: string): Uint8Array<ArrayBuffer> {
  let s = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function verifyDejoiyMailToken(
  token: string,
  secret: string | undefined,
  now: number = Date.now(),
): Promise<{ email: string; name: string; admin: string; photo: string }> {
  if (!secret) throw new ConvexError("Dejoiy Mail sign-in is not set up on this server yet.");
  const [body, sig, extra] = String(token || "").split(".");
  if (!body || !sig || extra !== undefined) throw new ConvexError("This sign-in link is not valid.");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  let ok = false;
  try {
    ok = await crypto.subtle.verify("HMAC", key, bytes(sig), enc.encode(body));
  } catch {
    ok = false;
  }
  if (!ok) throw new ConvexError("This sign-in link is not valid.");
  let claims: { e?: unknown; n?: unknown; a?: unknown; p?: unknown; x?: unknown };
  try {
    claims = JSON.parse(new TextDecoder().decode(bytes(body)));
  } catch {
    throw new ConvexError("This sign-in link is not valid.");
  }
  if (typeof claims.x !== "number" || claims.x < now) {
    throw new ConvexError("This sign-in link has expired. Open Shine from Dejoiy Mail again.");
  }
  const email = String(claims.e ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) throw new ConvexError("This sign-in link is not valid.");
  // "platform" = Zimbra global admin, "company" = company (delegated) admin, "" = everyone else
  const admin = claims.a === "platform" || claims.a === "company" ? claims.a : "";
  // the mailbox's profile photo on Dejoiy Mail (only colleagues signed in to Dejoiy Mail can load it)
  const photo = typeof claims.p === "string" && /^https:\/\/[^\s"'<>]{1,500}$/.test(claims.p) ? claims.p : "";
  return { email, name: String(claims.n ?? "").trim().slice(0, 100), admin, photo };
}
