import { useCallback, useEffect, useRef, useState } from "react";

export interface RtcSignal {
  _id: string;
  fromId: string;
  toId: string;
  kind: "offer" | "answer" | "ice";
  payload: string;
  createdAt: number;
}

export const DEFAULT_ICE: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

export interface RtcOptions {
  enabled: boolean;
  myId: string;
  peerIds: string[];
  localStream: MediaStream | null;
  signals: RtcSignal[];
  send: (toId: string, kind: "offer" | "answer" | "ice", payload: string) => void;
  onRemoteStream: (peerId: string, stream: MediaStream) => void;
  onPeerState?: (peerId: string, state: "connecting" | "connected" | "failed" | "reconnecting") => void;
  /** Custom ICE servers (STUN + TURN). Defaults to Google STUN. */
  iceServers?: RTCIceServer[];
}

const MAX_RETRIES = 4;

/**
 * Full-mesh WebRTC over a reactive Convex signaling table.
 * Offerer per pair = lexicographically larger userId, so both sides agree.
 *
 * Reliability features:
 *  - Configurable STUN + TURN servers (pass your Coturn via `iceServers`).
 *  - Automatic reconnection: failed / disconnected peers are torn down and
 *    renegotiated from scratch (fresh offer), up to MAX_RETRIES.
 *  - ICE candidates arriving before the remote description are queued and
 *    flushed as soon as the remote description lands.
 */
export function useRtc(opts: RtcOptions) {
  const { enabled, myId, peerIds, localStream, signals, send, onRemoteStream, onPeerState } = opts;
  const iceServers = opts.iceServers && opts.iceServers.length > 0 ? opts.iceServers : DEFAULT_ICE;

  const pcsRef = useRef(new Map<string, RTCPeerConnection>());
  const remoteStreamsRef = useRef(new Map<string, MediaStream>());
  const pendingIceRef = useRef<{ peerId: string; candidate: RTCIceCandidateInit }[]>([]);
  const processedRef = useRef(new Set<string>());
  const retryRef = useRef(new Map<string, number>());
  const timersRef = useRef<number[]>([]);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  // Keep the latest ICE config available to newly created connections.
  const iceRef = useRef(iceServers);
  iceRef.current = iceServers;

  // bumping this re-runs the peer-connection effect (used for reconnection)
  const [, setRetryTick] = useState(0);
  const bumpRetry = useCallback(() => setRetryTick((t) => t + 1), []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const t = window.setTimeout(fn, ms);
    timersRef.current.push(t);
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  }, []);

  const ensurePeer = useCallback((peerId: string): RTCPeerConnection => {
    const existing = pcsRef.current.get(peerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers: iceRef.current });
    pcsRef.current.set(peerId, pc);
    const stream = new MediaStream();
    remoteStreamsRef.current.set(peerId, stream);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        optsRef.current.send(peerId, "ice", JSON.stringify(e.candidate.toJSON()));
      }
    };
    pc.ontrack = (e) => {
      if (e.streams && e.streams[0]) {
        e.streams[0].getTracks().forEach((t) => stream.addTrack(t));
      } else if (e.track) {
        stream.addTrack(e.track);
      }
      if (stream.getTracks().length > 0) {
        optsRef.current.onRemoteStream(peerId, stream);
      }
    };
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") {
        optsRef.current.onPeerState?.(peerId, "connected");
        retryRef.current.delete(peerId);
        const pending = pendingIceRef.current.filter((p) => p.peerId === peerId);
        pendingIceRef.current = pendingIceRef.current.filter((p) => p.peerId !== peerId);
        pending.forEach((p) => pc.addIceCandidate(p.candidate).catch(() => {}));
      } else if (state === "failed") {
        optsRef.current.onPeerState?.(peerId, "failed");
        retryPeer(peerId);
      } else if (state === "disconnected" || state === "new" || state === "connecting") {
        // transient — keep "connecting" state but wait for a timeout before retry
        optsRef.current.onPeerState?.(peerId, "connecting");
      }
    };
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === "failed") {
        optsRef.current.onPeerState?.(peerId, "reconnecting");
        retryPeer(peerId);
      } else if (state === "disconnected") {
        // give it a moment; if it doesn't recover, the connection-state handler retries
        optsRef.current.onPeerState?.(peerId, "reconnecting");
        schedule(() => {
          if (pc.iceConnectionState === "disconnected" && pcsRef.current.get(peerId) === pc) {
            retryPeer(peerId);
          }
        }, 4000);
      } else if (state === "connected") {
        optsRef.current.onPeerState?.(peerId, "connected");
        retryRef.current.delete(peerId);
      }
    };

    const local = optsRef.current.localStream;
    if (local) {
      local.getTracks().forEach((t) => {
        try {
          pc.addTrack(t, local);
        } catch {
          /* track already added */
        }
      });
    }
    return pc;
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const retryPeer = (peerId: string) => {
    const attempts = retryRef.current.get(peerId) ?? 0;
    if (attempts >= MAX_RETRIES) {
      optsRef.current.onPeerState?.(peerId, "failed");
      return;
    }
    retryRef.current.set(peerId, attempts + 1);
    optsRef.current.onPeerState?.(peerId, "reconnecting");
    schedule(() => {
      // only retry if the peer is still expected and the pc still exists
      if (!pcsRef.current.has(peerId)) return;
      if (!optsRef.current.peerIds.includes(peerId)) return;
      // tear down and renegotiate from scratch
      const pc = pcsRef.current.get(peerId);
      if (pc) {
        try {
          pc.close();
        } catch {
          /* noop */
        }
        pcsRef.current.delete(peerId);
        remoteStreamsRef.current.delete(peerId);
      }
      // re-created by the peer-connection effect
      bumpRetry();
    }, 2500);
  };

  // Create connections to current peers; close removed ones.
  useEffect(() => {
    if (!enabled) return;
    for (const pid of peerIds) {
      if (pid === myId) continue;
      ensurePeer(pid);
      const pc = pcsRef.current.get(pid)!;
      if (myId > pid && pc.signalingState === "stable" && !pc.localDescription) {
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            if (pc.localDescription) {
              optsRef.current.send(pid, "offer", JSON.stringify(pc.localDescription.toJSON()));
            }
          })
          .catch(() => {});
      }
    }
    for (const pid of Array.from(pcsRef.current.keys())) {
      if (pid !== myId && !peerIds.includes(pid)) {
        pcsRef.current.get(pid)?.close();
        pcsRef.current.delete(pid);
        remoteStreamsRef.current.delete(pid);
        pendingIceRef.current = pendingIceRef.current.filter((p) => p.peerId !== pid);
        retryRef.current.delete(pid);
      }
    }
  }, [enabled, peerIds, myId, ensurePeer]);

  // Attach local tracks to any connection that missed them (late media).
  useEffect(() => {
    if (!localStream) return;
    for (const [pid, pc] of pcsRef.current) {
      const senders = pc.getSenders().map((s) => s.track);
      localStream.getTracks().forEach((t) => {
        if (!senders.includes(t)) {
          try {
            pc.addTrack(t, localStream);
          } catch {
            /* noop */
          }
        }
      });
    }
  }, [localStream]);

  // Consume incoming signaling messages.
  useEffect(() => {
    if (!enabled) return;
    for (const sig of signals) {
      if (sig.fromId === myId) continue;
      const key = `${sig.fromId}:${sig.kind}:${sig.payload}`;
      if (processedRef.current.has(key)) continue;
      processedRef.current.add(key);

      const peerId = sig.fromId;
      const pc = ensurePeer(peerId);
      let payload: unknown;
      try {
        payload = JSON.parse(sig.payload);
      } catch {
        continue;
      }

      if (sig.kind === "offer") {
        pc.setRemoteDescription(payload as RTCSessionDescriptionInit)
          .then(async () => {
            // flush any ICE candidates that arrived before the remote description
            const pending = pendingIceRef.current.filter((p) => p.peerId === peerId);
            pendingIceRef.current = pendingIceRef.current.filter((p) => p.peerId !== peerId);
            for (const p of pending) {
              pc.addIceCandidate(p.candidate).catch(() => {});
            }
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            if (pc.localDescription) {
              optsRef.current.send(peerId, "answer", JSON.stringify(pc.localDescription.toJSON()));
            }
          })
          .catch(() => {});
      } else if (sig.kind === "answer") {
        pc.setRemoteDescription(payload as RTCSessionDescriptionInit)
          .then(() => {
            const pending = pendingIceRef.current.filter((p) => p.peerId === peerId);
            pendingIceRef.current = pendingIceRef.current.filter((p) => p.peerId !== peerId);
            pending.forEach((p) => pc.addIceCandidate(p.candidate).catch(() => {}));
          })
          .catch(() => {});
      } else if (sig.kind === "ice") {
        const candidate = payload as RTCIceCandidateInit;
        if (pc.remoteDescription && pc.iceConnectionState !== "failed") {
          pc.addIceCandidate(candidate).catch(() => {});
        } else {
          pendingIceRef.current.push({ peerId, candidate });
        }
      }
    }
    // keep the processed set from growing forever
    if (processedRef.current.size > 5000) {
      const arr = Array.from(processedRef.current);
      processedRef.current = new Set(arr.slice(arr.length - 2500));
    }
  }, [enabled, signals, myId, ensurePeer]);

  const closeAll = useCallback(() => {
    clearTimers();
    for (const pc of pcsRef.current.values()) {
      try {
        pc.close();
      } catch {
        /* noop */
      }
    }
    pcsRef.current.clear();
    remoteStreamsRef.current.clear();
    pendingIceRef.current = [];
    retryRef.current.clear();
    processedRef.current.clear();
  }, [clearTimers]);

  useEffect(() => {
    if (!enabled) closeAll();
  }, [enabled, closeAll]);

  useEffect(() => () => closeAll(), [closeAll]);

  /** Swap the video track sent to peers (screen share / camera toggle). */
  const replaceVideoTrack = useCallback((track: MediaStreamTrack | null) => {
    for (const pc of pcsRef.current.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) sender.replaceTrack(track).catch(() => {});
    }
  }, []);

  /** Swap the audio track sent to peers (rarely needed, kept for symmetry). */
  const replaceAudioTrack = useCallback((track: MediaStreamTrack | null) => {
    for (const pc of pcsRef.current.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
      if (sender) sender.replaceTrack(track).catch(() => {});
    }
  }, []);

  /** Reconnect to a specific peer immediately (host action / manual retry). */
  const reconnectPeer = useCallback(
    (peerId: string) => {
      const pc = pcsRef.current.get(peerId);
      if (pc) {
        try {
          pc.close();
        } catch {
          /* noop */
        }
        pcsRef.current.delete(peerId);
        remoteStreamsRef.current.delete(peerId);
        retryRef.current.delete(peerId);
      }
      bumpRetry();
    },
    [bumpRetry],
  );

  return { replaceVideoTrack, replaceAudioTrack, reconnectPeer, closeAll };
}
