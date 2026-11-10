// Sign-in tokens minted by Dejoiy Mail (mail.dejoiy.com) for its signed-in users.
// Format: base64url(JSON {e: email, n: name, x: expiry ms, d: nonce}) + "." + base64url(HMAC-SHA256).
// The secret is shared with Dejoiy Mail (SHINE_SSO_SECRET there, DEJOIY_MAIL_SSO_SECRET here).
// No imports, so the same file runs in Convex and in plain Node for the tests.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function bytes(b64url: string): Uint8Array {
  let s = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function verifyDejoiyMailToken(
  token: string,
  secret: string | undefined,
  now: number = Date.now(),
): Promise<{ email: string; name: string }> {
  if (!secret) throw new Error("Dejoiy Mail sign-in is not set up on this server yet.");
  const [body, sig, extra] = String(token || "").split(".");
  if (!body || !sig || extra !== undefined) throw new Error("This sign-in link is not valid.");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  let ok = false;
  try {
    ok = await crypto.subtle.verify("HMAC", key, bytes(sig), enc.encode(body));
  } catch {
    ok = false;
  }
  if (!ok) throw new Error("This sign-in link is not valid.");
  let claims: { e?: unknown; n?: unknown; x?: unknown };
  try {
    claims = JSON.parse(new TextDecoder().decode(bytes(body)));
  } catch {
    throw new Error("This sign-in link is not valid.");
  }
  if (typeof claims.x !== "number" || claims.x < now) {
    throw new Error("This sign-in link has expired. Open Shine from Dejoiy Mail again.");
  }
  const email = String(claims.e ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) throw new Error("This sign-in link is not valid.");
  return { email, name: String(claims.n ?? "").trim().slice(0, 100) };
}
