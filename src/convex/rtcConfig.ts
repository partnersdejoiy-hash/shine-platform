import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Server-side ICE configuration for WebRTC meetings.
 *
 * Reads TURN/STUN servers from environment variables (set them in the
 * project's Keys/API keys tab — no redeploy needed):
 *
 *   RTC_STUN_URLS   optional, comma separated, e.g. "stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302"
 *   TURN_URL        optional, e.g. "turn:meet.dejoiy.com:3478?transport=udp"
 *   TURN_USERNAME   optional (coturn static-auth-secret HMAC or lt-cred-mech user)
 *   TURN_PASSWORD   optional
 *
 * When no TURN server is configured the client falls back to public Google
 * STUN (works for most networks; TURN is required for symmetric-NAT /
 * corporate firewalls). The self-hosted deploy ships a Coturn container —
 * point TURN_URL / TURN_USERNAME / TURN_PASSWORD at it and every room gets
 * relay support automatically.
 */
export const rtcConfig = query({
  args: {},
  handler: async () => {
    const stun = (process.env.RTC_STUN_URLS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const iceServers: { urls: string | string[]; username?: string; credential?: string }[] = [];

    if (stun.length > 0) {
      iceServers.push({ urls: stun });
    }

    const turnUrl = process.env.TURN_URL;
    const turnUser = process.env.TURN_USERNAME;
    const turnPass = process.env.TURN_PASSWORD;
    if (turnUrl && turnUser && turnPass) {
      iceServers.push({
        urls: [turnUrl],
        username: turnUser,
        credential: turnPass,
      });
    }

    return { iceServers };
  },
});

export const hasTurn = query({
  args: {},
  handler: async () => {
    return Boolean(process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_PASSWORD);
  },
});
