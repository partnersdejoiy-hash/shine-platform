/**
 * A LiveKit access token (a JWT signed with the server's API secret), made here so the browser never
 * sees the secret. It lets one person into one room for a few hours, and nothing else.
 */
export type LiveKitGrant = {
  room: string;
  identity: string;
  name: string;
  canPublish: boolean;
};

export const TOKEN_HOURS = 6;

const enc = new TextEncoder();
const b64u = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const part = (value: unknown) => b64u(enc.encode(JSON.stringify(value)));

export async function liveKitToken(apiKey: string, apiSecret: string, grant: LiveKitGrant, now = Date.now()): Promise<string> {
  const seconds = Math.floor(now / 1000);
  const body = `${part({ alg: "HS256", typ: "JWT" })}.${part({
    iss: apiKey,
    sub: grant.identity,
    name: grant.name,
    nbf: seconds - 10,
    exp: seconds + TOKEN_HOURS * 3600,
    video: {
      room: grant.room,
      roomJoin: true,
      canSubscribe: true,
      canPublish: grant.canPublish,
      canPublishData: true,
    },
  })}`;
  const key = await crypto.subtle.importKey("raw", enc.encode(apiSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
  return `${body}.${b64u(mac)}`;
}
