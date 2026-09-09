import { api } from "@/convex/api";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useRtc } from "@/hooks/use-rtc";
import { displayName } from "@/lib/format";
import { playCallConnect, playCallEnd } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@/convex/react";
import { motion } from "framer-motion";
import {
  MonitorUp,
  Phone,
  PhoneOff,
  PhoneIncoming,
  Radio,
  Video,
  VideoOff,
  Mic,
  MicOff,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

export function CallOverlay() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const live = useQuery(api.calls.liveCalls);
  const rtcConfig = useQuery(api.rtcConfig.rtcConfig);
  const sendSignal = useMutation(api.calls.sendSignal);
  const accept = useMutation(api.calls.accept);
  const decline = useMutation(api.calls.decline);
  const end = useMutation(api.calls.end);

  const incoming = live?.incoming?.[0] ?? null;
  const active = live?.active?.[0] ?? null;
  const activeCallId = active?._id ?? null;
  const signals = useQuery(api.calls.signalsFor, activeCallId ? { callId: activeCallId } : "skip");

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [callState, setCallState] = useState<"ringing" | "connected">("ringing");
  const [error, setError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const replaceVideoTrackRef = useRef<((t: MediaStreamTrack | null) => void) | null>(null);
  const [recording, setRecording] = useState(false);

  const myId = user?._id ?? "";
  const other = active?.other ?? null;
  const peerId = other?._id ?? "";
  const isVideo = active?.kind === "video" || incoming?.kind === "video";

  // stop local stream on unmount
  useEffect(() => {
    return () => {
      localStream?.getTracks().forEach((t) => t.stop());
      displayStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // remote stream binding
  useEffect(() => {
    const stream = remoteStreams[peerId];
    if (stream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStreams, peerId]);

  // local video binding
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream]);

  // Webrtc mesh for the active call
  const { replaceVideoTrack } = useRtc({
    enabled: !!active && !!localStream,
    myId,
    peerIds: peerId ? [peerId] : [],
    localStream,
    signals: signals ?? [],
    iceServers: rtcConfig?.iceServers,
    send: useCallback(
      (toId: string, kind: "offer" | "answer" | "ice", payload: string) => {
        if (!activeCallId) return;
        sendSignal({ callId: activeCallId, toId: toId as any, kind, payload }).catch(() => {});
      },
      [activeCallId, sendSignal],
    ),
    onRemoteStream: useCallback((pid: string, stream: MediaStream) => {
      setRemoteStreams((prev) => ({ ...prev, [pid]: stream }));
      setCallState("connected");
    }, []),
  });
  replaceVideoTrackRef.current = replaceVideoTrack;

  // ring while incoming
  useEffect(() => {
    if (incoming) {
      const id = setInterval(() => {
        try {
          const AC = window.AudioContext;
          const ac = new AC();
          const osc = ac.createOscillator();
          const g = ac.createGain();
          osc.frequency.value = 720;
          g.gain.value = 0.04;
          osc.connect(g).connect(ac.destination);
          osc.start();
          setTimeout(() => {
            osc.stop();
            ac.close();
          }, 450);
        } catch {
          /* noop */
        }
      }, 900);
      return () => clearInterval(id);
    }
  }, [incoming]);

  const startLocalMedia = useCallback(async (withVideo: boolean) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: withVideo ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });
      setLocalStream(stream);
      return stream;
    } catch {
      setError("Could not access camera/microphone. Check permissions.");
      return null;
    }
  }, []);

  const handleAccept = async () => {
    if (!incoming) return;
    setError(null);
    const stream = await startLocalMedia(incoming.kind === "video");
    if (!stream) return;
    await accept({ callId: incoming._id });
    playCallConnect();
    setCallState("ringing");
  };

  const handleDecline = async () => {
    if (incoming) await decline({ callId: incoming._id });
    localStream?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
  };

  const handleEnd = async () => {
    if (active) await end({ callId: active._id });
    playCallEnd();
    localStream?.getTracks().forEach((t) => t.stop());
    displayStreamRef.current?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    setRemoteStreams({});
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  };

  const toggleMic = () => {
    localStream?.getAudioTracks().forEach((t) => (t.enabled = !micOn));
    setMicOn((v) => !v);
  };

  const toggleCam = () => {
    localStream?.getVideoTracks().forEach((t) => (t.enabled = !camOn));
    setCamOn((v) => !v);
  };

  const toggleShare = async () => {
    if (sharing) {
      displayStreamRef.current?.getTracks().forEach((t) => t.stop());
      displayStreamRef.current = null;
      setSharing(false);
      const videoTrack = localStream?.getVideoTracks()[0] ?? null;
      replaceVideoTrackRef.current?.(videoTrack);
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      displayStreamRef.current = display;
      setSharing(true);
      const track = display.getVideoTracks()[0];
      replaceVideoTrackRef.current?.(track);
      if (localVideoRef.current) localVideoRef.current.srcObject = display;
      track.onended = () => {
        displayStreamRef.current = null;
        setSharing(false);
        replaceVideoTrackRef.current?.(localStream?.getVideoTracks()[0] ?? null);
        if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
      };
    } catch {
      /* user cancelled */
    }
  };

  const toggleRecord = () => {
    if (!localStream) return;
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
      setRecording(false);
      return;
    }
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(localStream);
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: rec.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shine-call-${Date.now()}.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    };
    rec.start();
    recorderRef.current = rec;
    setRecording(true);
  };

  if (!incoming && !active) return null;

  // ---- Incoming call UI ------------------------------------------------------
  if (incoming && !active) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed inset-0 z-[90] grid place-items-center bg-black/70 backdrop-blur-md"
      >
        <div className="glass-strong hairline w-full max-w-sm rounded-3xl p-8 text-center shadow-2xl">
          <div className="mx-auto mb-5 w-fit">
            <div className="relative">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
              <UserAvatar
                user={incoming.caller}
                presence={{ status: "online" }}
                size="xl"
                className="relative"
              />
            </div>
          </div>
          <h3 className="text-xl font-bold">{displayName(incoming.caller)}</h3>
          <p className="mt-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <PhoneIncoming className="size-4 text-primary" />
            Incoming {isVideo ? "video" : "audio"} call
          </p>
          <div className="mt-7 flex items-center justify-center gap-5">
            <Button
              size="icon-lg"
              className="rounded-full bg-rose-500/90 hover:bg-rose-500"
              onClick={handleDecline}
              title="Decline"
            >
              <PhoneOff className="size-5" />
            </Button>
            <Button
              size="icon-lg"
              className="rounded-full bg-emerald-500 hover:bg-emerald-500"
              onClick={handleAccept}
              title="Accept"
            >
              <Phone className="size-5" />
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ---- Active call UI ---------------------------------------------------------
  if (active && myId) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[90] flex flex-col bg-black text-white"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <div className="flex items-center gap-3">
            <UserAvatar user={other} presence={{ status: "online" }} size="sm" />
            <div>
              <div className="text-sm font-semibold">{displayName(other)}</div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                {callState === "connected" ? "Connected · WebRTC" : "Connecting…"}
                {recording && (
                  <span className="ml-2 flex items-center gap-1 text-rose-400">
                    <Radio className="size-3 animate-pulse" /> REC
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Button
              variant="outline"
              size="sm"
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              onClick={() => navigate(`/app/chats/${active.conversationId}`)}
            >
              Open chat
            </Button>
          </div>
        </div>

        {error && (
          <div className="mx-auto mt-3 rounded-lg bg-rose-500/15 px-4 py-2 text-xs text-rose-300">
            {error}
          </div>
        )}

        <div className="relative flex flex-1 items-center justify-center p-4">
          {/* remote video */}
          {isVideo ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted={false}
              className={cn(
                "max-h-full max-w-full rounded-2xl border border-white/10 object-contain",
                !remoteStreams[peerId] && "opacity-40",
              )}
            />
          ) : (
            <div className="grid h-full w-full place-items-center">
              <div className="text-center">
                <div className="mx-auto mb-4 w-fit">
                  <UserAvatar user={other} presence={{ status: "online" }} size="xl" />
                </div>
                <div className="text-lg font-semibold">{displayName(other)}</div>
                <div className="mt-1 text-sm text-white/50">
                  {callState === "connected"
                    ? `Audio call · ${isVideo ? "" : ""}`
                    : "Establishing secure connection…"}
                </div>
              </div>
            </div>
          )}
          {!remoteStreams[peerId] && isVideo && (
            <div className="absolute inset-0 grid place-items-center text-sm text-white/50">
              Waiting for {displayName(other)}…
            </div>
          )}

          {/* local preview */}
          {localStream && (
            <div className="absolute bottom-4 right-4 overflow-hidden rounded-xl border border-white/20 shadow-xl">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="h-36 w-28 object-cover"
              />
              {!camOn && (
                <div className="absolute inset-0 grid place-items-center bg-zinc-900">
                  <VideoOff className="size-6 text-white/50" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* controls */}
        <div className="flex items-center justify-center gap-3 pb-6 pt-2">
          <button
            onClick={toggleMic}
            className={cn(
              "grid size-12 place-items-center rounded-full transition-all",
              micOn ? "bg-white/10 hover:bg-white/20" : "bg-rose-500/90 hover:bg-rose-500",
            )}
            title={micOn ? "Mute" : "Unmute"}
          >
            {micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
          </button>
          {isVideo && (
            <button
              onClick={toggleCam}
              className={cn(
                "grid size-12 place-items-center rounded-full transition-all",
                camOn ? "bg-white/10 hover:bg-white/20" : "bg-rose-500/90 hover:bg-rose-500",
              )}
              title={camOn ? "Camera off" : "Camera on"}
            >
              {camOn ? <Video className="size-5" /> : <VideoOff className="size-5" />}
            </button>
          )}
          <button
            onClick={toggleShare}
            className={cn(
              "grid size-12 place-items-center rounded-full transition-all",
              sharing ? "bg-primary text-black" : "bg-white/10 hover:bg-white/20",
            )}
            title="Share screen"
          >
            <MonitorUp className="size-5" />
          </button>
          <button
            onClick={toggleRecord}
            className={cn(
              "grid size-12 place-items-center rounded-full transition-all",
              recording ? "bg-rose-500 text-white" : "bg-white/10 hover:bg-white/20",
            )}
            title="Record (local view)"
          >
            <Radio className="size-5" />
          </button>
          <button
            onClick={handleEnd}
            className="grid size-14 place-items-center rounded-full bg-rose-500 shadow-[0_8px_30px_-8px_rgba(244,63,94,0.8)] transition-transform hover:scale-105"
            title="End call"
          >
            <PhoneOff className="size-6" />
          </button>
        </div>
      </motion.div>
    );
  }

  return null;
}
