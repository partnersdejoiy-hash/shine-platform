import { useCallback, useEffect, useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { Room, RoomEvent, Track, type LocalTrackPublication, type RemoteParticipant, type RemoteTrack } from "livekit-client";
import { api } from "@/convex/_generated/api";
import { useRtc, type RtcOptions } from "./use-rtc";

export type CallRoom = { kind: "call" | "meeting"; id: string } | null;

/**
 * Media for a call or meeting. Goes through Shine's LiveKit media server when it is set up
 * (works on mobile data and office networks, and for big meetings, like Google Meet); when it is not
 * set up, direct WebRTC between the browsers (use-rtc). Never a mix: everyone in a room uses one path.
 * Same options and return value as useRtc, plus the room to join.
 */
export function useCallMedia(opts: RtcOptions & { room: CallRoom }) {
  const serverOn = useQuery(api.liveKit.enabled);
  const getToken = useAction(api.liveKit.token);
  const viaServer = serverOn === true;

  const mesh = useRtc({ ...opts, enabled: opts.enabled && serverOn !== undefined && !viaServer });
  const lk = useLiveKit({
    enabled: opts.enabled && viaServer && !!opts.room,
    room: opts.room,
    localStream: opts.localStream,
    onRemoteStream: opts.onRemoteStream,
    onPeerState: opts.onPeerState,
    getToken,
  });
  return viaServer ? lk : mesh;
}

type LiveKitOptions = {
  enabled: boolean;
  room: CallRoom;
  localStream: MediaStream | null;
  onRemoteStream: RtcOptions["onRemoteStream"];
  onPeerState?: RtcOptions["onPeerState"];
  getToken: (args: { kind: "call" | "meeting"; id: string }) => Promise<{ url: string; token: string } | null>;
};

function useLiveKit(opts: LiveKitOptions) {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const roomRef = useRef<Room | null>(null);
  const [connected, setConnected] = useState(false);
  const [attempt, setAttempt] = useState(0);   // bumped to join the room again after the line dropped
  const triesRef = useRef(0);                   // failed joins in a row; reset once in
  const { enabled } = opts;
  const kind = opts.room?.kind, id = opts.room?.id;

  useEffect(() => {
    if (!enabled || !kind || !id) return;
    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    const streams = new Map<string, MediaStream>();
    // a fresh MediaStream each time a track comes or goes, so the page re-binds its <video>
    const update = (p: RemoteParticipant, add?: MediaStreamTrack, remove?: MediaStreamTrack) => {
      const keep = (streams.get(p.identity)?.getTracks() ?? []).filter((t) => t !== remove && (!add || t.kind !== add.kind));
      const stream = new MediaStream(add ? [...keep, add] : keep);
      streams.set(p.identity, stream);
      optsRef.current.onRemoteStream(p.identity, stream);
    };
    const peerState = (state: "connecting" | "connected" | "failed" | "reconnecting") =>
      room.remoteParticipants.forEach((p) => optsRef.current.onPeerState?.(p.identity, state));

    room
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub, p: RemoteParticipant) => {
        update(p, track.mediaStreamTrack);
        optsRef.current.onPeerState?.(p.identity, "connected");
      })
      .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, _pub, p: RemoteParticipant) => update(p, undefined, track.mediaStreamTrack))
      .on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => optsRef.current.onPeerState?.(p.identity, "connecting"))
      .on(RoomEvent.Reconnecting, () => peerState("reconnecting"))
      .on(RoomEvent.Reconnected, () => peerState("connected"))
      .on(RoomEvent.Disconnected, () => {
        setConnected(false);
        if (cancelled) return;
        peerState("reconnecting");
        retry();
      });
    // both people must use the same path, so a network problem is retried here, never answered with direct calls
    const retry = () => {
      if (triesRef.current >= 6) return peerState("failed");
      triesRef.current += 1;
      window.setTimeout(() => !cancelled && setAttempt((n) => n + 1), 1000 + triesRef.current * 1500);
    };

    (async () => {
      try {
        const pass = await optsRef.current.getToken({ kind, id });
        if (cancelled) return;
        if (!pass) throw new Error("Not let into the room (yet)");   // e.g. just admitted from the lobby
        await room.connect(pass.url, pass.token);
        if (cancelled) return void room.disconnect();
        triesRef.current = 0;
        setConnected(true);
      } catch (e) {
        console.warn("Media server not reachable, trying again:", e);
        if (!cancelled) retry();
      }
    })();
    return () => {
      cancelled = true;
      setConnected(false);
      roomRef.current = null;
      void room.disconnect(false);   // the page owns the camera and mic; it stops them
    };
  }, [enabled, kind, id, attempt]);

  // send the camera and mic (again whenever the page swaps its local stream)
  const localStream = opts.localStream;
  useEffect(() => {
    const room = roomRef.current;
    if (!connected || !room || !localStream || !room.localParticipant.permissions?.canPublish) return;
    const published: LocalTrackPublication[] = [];
    let stale = false;
    for (const track of localStream.getTracks()) {
      const source = track.kind === "audio" ? Track.Source.Microphone : Track.Source.Camera;
      room.localParticipant
        .publishTrack(track, { source })
        .then((pub) => {
          if (stale && pub.track) void room.localParticipant.unpublishTrack(pub.track, false);
          else published.push(pub);
        })
        .catch((e) => console.warn("Could not send", track.kind, e));
    }
    return () => {
      stale = true;
      for (const pub of published) if (pub.track) void room.localParticipant.unpublishTrack(pub.track, false);
    };
  }, [connected, localStream]);

  /** Swap the video being sent (screen share and back); null pauses it. */
  const replaceVideoTrack = useCallback((track: MediaStreamTrack | null) => {
    const pub = roomRef.current?.localParticipant.getTrackPublication(Track.Source.Camera);
    if (!pub?.track) return;
    if (!track) return void pub.mute();
    void pub.track.replaceTrack(track, true).then(() => pub.unmute());
  }, []);
  const replaceAudioTrack = useCallback((track: MediaStreamTrack | null) => {
    const pub = roomRef.current?.localParticipant.getTrackPublication(Track.Source.Microphone);
    if (!pub?.track) return;
    if (!track) return void pub.mute();
    void pub.track.replaceTrack(track, true).then(() => pub.unmute());
  }, []);
  // the media server reconnects by itself; a manual retry joins the room again
  const reconnectPeer = useCallback(() => {
    triesRef.current = 0;
    setAttempt((n) => n + 1);
  }, []);
  const closeAll = useCallback(() => void roomRef.current?.disconnect(false), []);
  return { replaceVideoTrack, replaceAudioTrack, reconnectPeer, closeAll };
}
