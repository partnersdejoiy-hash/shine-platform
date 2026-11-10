import { api } from "@/convex/_generated/api";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/use-auth";
import { useRtc, type RtcSignal } from "@/hooks/use-rtc";
import { displayName, formatDuration, meetingUrl } from "@/lib/format";
import { meetingSiteBase } from "@/pages/MeetHome";
import { QUICK_REACTIONS } from "@/lib/emoji";
import { cn } from "@/lib/utils";
import { ReportDialog } from "@/components/meeting/ReportDialog";
import { useMutation, useQuery } from "convex/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AudioLines,
  BarChart3,
  Captions,
  Check,
  Clock,
  Crown,
  DoorOpen,
  FileSpreadsheet,
  Hand,
  LayoutGrid,
  Loader2,
  Lock,
  LogOut,
  MessageSquare,
  Mic,
  MicOff,
  Minus,
  MonitorUp,
  PhoneOff,
  Plus,
  Radio,
  ScreenShare,
  Send,
  ShieldCheck,
  Unlock,
  UserPlus,
  Users,
  Video,
  VideoOff,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

type PeerState = "connecting" | "connected" | "failed" | "reconnecting";

export function MeetingRoom() {
  const { id: routeId, code: routeCode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const myId = user?._id ?? "";

  // Stable share links are /meet/<slug>/<room-code> — resolve the code to the
  // meeting id when no raw id is in the URL, then load detail as usual.
  const byCode = useQuery(
    api.meetings.detailByCode,
    routeCode && !routeId ? { roomCode: routeCode } : "skip",
  );
  const id = routeId ?? (byCode?.meeting?._id as string | undefined);

  const detail = useQuery(api.meetings.detail, id ? { meetingId: id as any } : "skip");
  const signals = useQuery(api.calls.meetingSignalsFor, id ? { meetingId: id as any } : "skip");
  const rtcConfig = useQuery(api.rtcConfig.rtcConfig);
  const messagesPage = useQuery(
    api.messages.list,
    detail?.conversationId ? { conversationId: detail.conversationId as any } : "skip",
  );
  const [reportOpen, setReportOpen] = useState(false);

  // Meeting report (host/co-host) — queried lazily when the report dialog opens
  const reportData = useQuery(
    api.meetings.meetingReport,
    reportOpen && id ? { meetingId: id as any } : "skip",
  );

  const join = useMutation(api.meetings.join);
  const leave = useMutation(api.meetings.leave);
  const endMeeting = useMutation(api.meetings.end);
  const setState = useMutation(api.meetings.setParticipantState);
  const sendSignal = useMutation(api.calls.sendMeetingSignal);
  const sendMsg = useMutation(api.messages.send);
  const admitParticipant = useMutation(api.meetings.admitParticipant);
  const setLobbyEnabled = useMutation(api.meetings.setLobbyEnabled);
  const setLocked = useMutation(api.meetings.setLocked);
  const setParticipantRole = useMutation(api.meetings.setParticipantRole);
  const removeParticipant = useMutation(api.meetings.removeParticipant);
  const muteAll = useMutation(api.meetings.muteAll);
  const createBreakoutRooms = useMutation(api.meetings.createBreakoutRooms);
  const assignToBreakout = useMutation(api.meetings.assignToBreakout);
  const startBreakouts = useMutation(api.meetings.startBreakouts);
  const endBreakouts = useMutation(api.meetings.endBreakouts);
  const createPoll = useMutation(api.messages.createPoll);
  const votePoll = useMutation(api.messages.votePoll);
  const closePoll = useMutation(api.messages.closePoll);
  const logActivity = useMutation(api.meetings.logActivity);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [peerStates, setPeerStates] = useState<Record<string, PeerState>>({});
  const [joined, setJoined] = useState(false);
  const [requestedJoin, setRequestedJoin] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [captions, setCaptions] = useState(false);
  const [captionText, setCaptionText] = useState("");
  const [recording, setRecording] = useState(false);
  const [rightPanel, setRightPanel] = useState<"chat" | "people" | null>("chat");
  const [elapsed, setElapsed] = useState(0);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [endedToastShown, setEndedToastShown] = useState(false);
  const [breakoutOpen, setBreakoutOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const leftRef = useRef(false);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  // breakout override: once a participant chooses to stay in the main meeting,
  // the auto-move effect must not shove them back into their breakout room
  const stayInMainRef = useRef(false);
  const captionsOnRef = useRef(false);
  useEffect(() => {
    captionsOnRef.current = captions;
  }, [captions]);
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Only show participants who have actually joined (status is set).
  // Invited users get a meetingParticipants row at creation time with NO status;
  // status is set to "active" or "waiting" only when they actually join.
  const participants = useMemo(
    () =>
      (detail?.participants ?? []).filter(
        (p) => !p.leftAt && (p.status === "active" || p.status === "waiting" || p.status === "denied"),
      ),
    [detail],
  );
  const activeParticipants = useMemo(
    () => participants.filter((p) => p.status !== "waiting" && p.status !== "denied"),
    [participants],
  );
  const waitingParticipants = useMemo(
    () => participants.filter((p) => p.status === "waiting"),
    [participants],
  );
  const myParticipant = useMemo(
    () => participants.find((p) => p.user._id === myId),
    [participants, myId],
  );
  const peerIds = useMemo(
    () => activeParticipants.map((p) => p.user._id).filter((pid) => pid !== myId),
    [activeParticipants, myId],
  );
  const isHost = detail?.meeting.hostId === myId;
  const isModerator = myParticipant?.role === "moderator";
  const canManage = isHost || isModerator;
  const isWebinar = detail?.meeting.kind === "webinar";
  const isViewer = isWebinar && !isHost;
  const meetingEnded = detail?.meeting.status === "ended";
  const isChildRoom = !!detail?.meeting.parentMeetingId;
  const breakoutsActive = !!detail?.meeting.breakoutsActive;
  const myBreakout = detail?.meeting.breakoutRooms?.find((r) =>
    r.participantIds.some((uid) => String(uid) === String(myId)),
  );
  const amWaiting = myParticipant?.status === "waiting";
  const amDenied = myParticipant?.status === "denied";

  const rtc = useRtc({
    enabled: joined,
    myId,
    peerIds,
    localStream,
    signals: (signals ?? []) as RtcSignal[],
    iceServers: rtcConfig?.iceServers,
    send: useCallback(
      (toId: string, kind: "offer" | "answer" | "ice", payload: string) => {
        if (!id) return;
        sendSignal({ meetingId: id as any, toId: toId as any, kind, payload }).catch(() => {});
      },
      [id, sendSignal],
    ),
    onRemoteStream: useCallback((pid: string, stream: MediaStream) => {
      setRemoteStreams((prev) => {
        if (prev[pid] === stream) return prev;
        return { ...prev, [pid]: stream };
      });
    }, []),
    onPeerState: useCallback((pid: string, state: PeerState) => {
      setPeerStates((prev) => {
        if (prev[pid] === state) return prev;
        return { ...prev, [pid]: state };
      });
    }, []),
  });

  // timer
  useEffect(() => {
    if (!joined) return;
    const start = Date.now();
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [joined]);

  // clean up when leaving the room (navigating away, breakout move, end, tab close)
  useEffect(() => {
    return () => {
      if (id && !leftRef.current) {
        leave({ meetingId: id as any }).catch(() => {});
      }
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // auto-exit when the meeting ends — breakout children return to the main room
  useEffect(() => {
    if (joined && meetingEnded && !endedToastShown) {
      setEndedToastShown(true);
      toast("This meeting has ended.");
      const t = setTimeout(() => {
        navigate(detail?.meeting.parentMeetingId ? `/meet/${detail.meeting.parentMeetingId}` : "/meet");
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [joined, meetingEnded, endedToastShown, navigate, detail?.meeting.parentMeetingId]);

  // denied (or removed) → show the denial screen
  useEffect(() => {
    if (amDenied && joined) setJoined(false);
  }, [amDenied, joined]);

  // keyboard shortcuts (M mic · V cam · R hand · C captions · H chat)
  useEffect(() => {
    if (!joined) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key.toLowerCase() === "m") toggleMicRef.current();
      if (e.key.toLowerCase() === "v") toggleCamRef.current();
      if (e.key.toLowerCase() === "r") toggleHandRef.current();
      if (e.key.toLowerCase() === "c") toggleCaptionsRef.current();
      if (e.key.toLowerCase() === "h") setRightPanel((p) => (p === "chat" ? null : "chat"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [joined]);

  const toggleMicRef = useRef<() => void>(() => {});
  const toggleCamRef = useRef<() => void>(() => {});
  const toggleHandRef = useRef<() => void>(() => {});
  const toggleCaptionsRef = useRef<() => void>(() => {});

  // ask for camera/mic as soon as the lobby loads so the host sees their own
  // preview (previously media was only acquired on Join — no preview ever)
  useEffect(() => {
    if (isViewer || localStream || !id || !detail) return;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setLocalStream(stream);
        setMicOn(true);
        setCamOn(true);
      })
      .catch(() => {
        if (!cancelled) {
          setMediaError("Camera/microphone access denied. You can still join without media.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isViewer, localStream, id, detail]);

  // join flow — waiting-room users are admitted reactively when the host admits them
  const handleJoin = async () => {
    try {
      if (!isViewer && !localStream) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        setLocalStream(stream);
        setMicOn(true);
        setCamOn(true);
      }
      if (id) {
        await join({ meetingId: id as any, isMuted: isViewer, isVideoOn: !isViewer });
        track("joined", isViewer ? "as viewer" : "with media");
      }
      setRequestedJoin(true);
      if (isViewer) toast("You joined as a viewer — mic & camera are off");
    } catch (e) {
      setMediaError(e instanceof Error ? e.message : "Camera/microphone access denied. You can still join without media.");
      if (id) {
        await join({ meetingId: id as any, isMuted: true, isVideoOn: false }).catch(() => {});
        track("joined", "no media");
        setRequestedJoin(true);
      }
    }
  };

  // once the participant record shows us as active (either immediately, or after
  // the host admits us from the waiting room), actually enter the call
  useEffect(() => {
    if (requestedJoin && !joined && myParticipant?.status === "active") {
      setJoined(true);
      setRightPanel(isWebinar ? "chat" : "chat");
    }
  }, [requestedJoin, joined, myParticipant?.status, isWebinar]);

  // breakout rooms: when they go live and I'm assigned, move me into the child room.
  // Once the user explicitly returns to the main meeting (stayInMainRef), don't push
  // them back — they can rejoin anytime via the "Rejoin breakout" chip.
  useEffect(() => {
    if (!joined || !detail) return;
    if (breakoutsActive && !isChildRoom && myBreakout?.childMeetingId && !stayInMainRef.current) {
      const target = `/meet/${myBreakout.childMeetingId}`;
      if (window.location.pathname !== target) navigate(target);
    }
  }, [breakoutsActive, isChildRoom, myBreakout?.childMeetingId, joined, navigate, detail]);

  // when breakouts end, clear the stay-in-main override so a future breakout session
  // can auto-move people again
  useEffect(() => {
    if (!breakoutsActive) stayInMainRef.current = false;
  }, [breakoutsActive]);

  // bind the local <video> synchronously (reliable across lobby → in-call) and
  // remember the current element so screen-share swaps can target it
  const bindLocalVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      localVideoRef.current = el;
      if (el) el.srcObject = localStream;
    },
    [localStream],
  );

  // bind local video to the current element whenever the stream changes
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream]);

  const cameraTrack = useMemo(() => localStream?.getVideoTracks()[0] ?? null, [localStream]);

  // fire-and-forget activity logging for the meeting report
  const track = useCallback((type: string, detailStr?: string) => {
    if (id) logActivity({ meetingId: id as any, type, detail: detailStr }).catch(() => {});
  }, [id, logActivity]);

  const toggleMic = useCallback(() => {
    localStream?.getAudioTracks().forEach((t) => (t.enabled = !micOn));
    setMicOn((v) => !v);
    if (id) {
      setState({ meetingId: id as any, isMuted: micOn }).catch(() => {});
      track("mic_toggle", micOn ? "muted" : "unmuted");
    }
  }, [localStream, micOn, id, setState, track]);
  toggleMicRef.current = toggleMic;

  const toggleCam = useCallback(() => {
    localStream?.getVideoTracks().forEach((t) => (t.enabled = !camOn));
    setCamOn((v) => !v);
    if (id) {
      setState({ meetingId: id as any, isVideoOn: camOn }).catch(() => {});
      track("camera_toggle", camOn ? "off" : "on");
    }
  }, [localStream, camOn, id, setState, track]);
  toggleCamRef.current = toggleCam;

  const toggleHand = useCallback(() => {
    setHandRaised((v) => !v);
    if (id) {
      setState({ meetingId: id as any, hasRaisedHand: !handRaised }).catch(() => {});
      track("hand_raise", handRaised ? "lowered" : "raised");
    }
  }, [handRaised, id, setState, track]);
  toggleHandRef.current = toggleHand;

  // screen share — the display video track replaces the camera track on every
  // peer connection, so everyone sees the shared screen, not just the presenter.
  const toggleShare = async () => {
    if (sharing) {
      displayStreamRef.current?.getTracks().forEach((t) => t.stop());
      displayStreamRef.current = null;
      setSharing(false);
      track("screen_share_stop");
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
      rtc.replaceVideoTrack(cameraTrack);
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } },
        audio: true,
      });
      displayStreamRef.current = display;
      setSharing(true);
      track("screen_share_start", "presented");
      const displayTrack = display.getVideoTracks()[0];
      rtc.replaceVideoTrack(displayTrack);
      if (localVideoRef.current) localVideoRef.current.srcObject = display;
      displayTrack.onended = () => {
        displayStreamRef.current = null;
        setSharing(false);
        track("screen_share_stop", "auto");
        if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
        rtc.replaceVideoTrack(cameraTrack);
      };
    } catch {
      /* cancelled */
    }
  };

  const toggleRecord = () => {
    if (!localStream) return;
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
      setRecording(false);
      return;
    }
    recChunksRef.current = [];
    const rec = new MediaRecorder(localStream);
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) recChunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(recChunksRef.current, { type: rec.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shine-meeting-${detail?.meeting.roomCode ?? "rec"}.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    };
    rec.start();
    recorderRef.current = rec;
    setRecording(true);
  };

  // live captions — transcribes the local mic; auto-restarts if the recognizer
  // stops so captions never silently die mid-meeting
  const startRecognition = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return null;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e: any) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      setCaptionText(text);
    };
    rec.onend = () => {
      // SpeechRecognition stops on silence by default — keep it alive while on
      if (captionsOnRef.current) {
        try {
          rec.start();
        } catch {
          /* already starting */
        }
      }
    };
    rec.onerror = (e: any) => {
      if (e?.error === "not-allowed") {
        setCaptions(false);
        toast("Captions need microphone access");
        return;
      }
      if (captionsOnRef.current) {
        setTimeout(() => {
          try {
            rec.start();
          } catch {
            /* noop */
          }
        }, 500);
      }
    };
    rec.start();
    return rec;
  }, []);

  const toggleCaptions = useCallback(() => {
    if (captions) {
      recognitionRef.current?.stop?.();
      setCaptions(false);
      setCaptionText("");
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast("Live captions need a Chromium browser");
      return;
    }
    const rec = startRecognition();
    recognitionRef.current = rec;
    setCaptions(true);
    setCaptionText("");
  }, [captions, startRecognition]);
  toggleCaptionsRef.current = toggleCaptions;

  const handleLeave = async () => {
    track("leave");
    leftRef.current = true;
    // leaving a breakout room = returning to the main meeting, and stay there
    if (isChildRoom) stayInMainRef.current = true;
    if (id) await leave({ meetingId: id as any }).catch(() => {});
    localStream?.getTracks().forEach((t) => t.stop());
    displayStreamRef.current?.getTracks().forEach((t) => t.stop());
    navigate(isChildRoom && detail?.meeting.parentMeetingId ? `/meet/${detail.meeting.parentMeetingId}` : "/meet");
  };

  const handleEnd = async () => {
    track("end_meeting");
    if (id) await endMeeting({ meetingId: id as any }).catch(() => {});
    await handleLeave();
  };

  const handleReturnToMain = async () => {
    leftRef.current = true;
    stayInMainRef.current = true;
    if (id) await leave({ meetingId: id as any }).catch(() => {});
    if (detail?.meeting.parentMeetingId) navigate(`/meet/${detail.meeting.parentMeetingId}`);
    else navigate("/meet");
  };

  // rejoin my assigned breakout after opting to stay in the main meeting
  const handleRejoinBreakout = () => {
    if (!myBreakout?.childMeetingId) return;
    stayInMainRef.current = false;
    navigate(`/meet/${myBreakout.childMeetingId}`);
  };

  // host / co-host: jump into any specific breakout room (and back anytime)
  const handleEnterBreakout = (childMeetingId: string) => {
    stayInMainRef.current = false;
    navigate(`/meet/${childMeetingId}`);
  };

  const setParticipantMuted = async (userId: string, muted: boolean) => {
    await setState({ meetingId: id as any, isMuted: muted }).catch(() => {});
    toast(muted ? "Participant muted" : "Unmute requested");
  };

  const handleAdmit = (userId: string, admit: boolean) => {
    if (!id) return;
    admitParticipant({ meetingId: id as any, userId: userId as any, admit })
      .then(() => toast(admit ? "Participant admitted" : "Request denied"))
      .catch((e) => toast(e.message));
  };

  const handleAdmitAll = () => {
    if (!id) return;
    waitingParticipants.forEach((p) => {
      admitParticipant({ meetingId: id as any, userId: p.user._id as any, admit: true }).catch(() => {});
    });
    toast(`Admitted ${waitingParticipants.length} people`);
  };

  const handleRemove = (userId: string) => {
    if (!id) return;
    removeParticipant({ meetingId: id as any, userId: userId as any })
      .then(() => toast("Removed from meeting"))
      .catch((e) => toast(e.message));
  };

  const handleSetRole = (userId: string, role: "moderator" | "participant") => {
    if (!id) return;
    setParticipantRole({ meetingId: id as any, userId: userId as any, role })
      .then(() => toast(role === "moderator" ? "Made co-host" : "Removed as co-host"))
      .catch((e) => toast(e.message));
  };

  const handleMuteAll = () => {
    if (!id) return;
    muteAll({ meetingId: id as any })
      .then(() => toast("Everyone muted (except hosts)"))
      .catch((e) => toast(e.message));
  };

  const handleInvite = () => {
    if (!detail?.meeting) return;
    const link = meetingUrl(meetingSiteBase(), detail.meeting);
    navigator.clipboard.writeText(link).catch(() => {});
    toast("Invite link copied — share it with anyone");
  };

  const handleCreatePoll = async (question: string, options: string[]) => {
    track("poll_created", question);
    if (!detail?.conversationId) {
      toast("No meeting chat available");
      return;
    }
    await createPoll({
      conversationId: detail.conversationId as any,
      question,
      options,
    });
    toast("Poll launched in the meeting chat");
  };

  // build + download the Excel report from the already-loaded reportData
  const handleDownloadReport = async () => {
    if (!reportData) {
      toast("Report is still loading…");
      return;
    }
    try {
      const report = reportData;
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      const m = report.meeting;
      const host = report.host;
      const total = report.participants.length || 1;
      const present = report.participants.filter((p: any) => !p.leftAt).length;

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet([
          { Field: "Meeting title", Value: m.title },
          { Field: "Room code", Value: m.roomCode },
          { Field: "Share link", Value: meetingUrl(meetingSiteBase(), m) },
          { Field: "Host", Value: host ? displayName(host) : "Unknown" },
          { Field: "Status", Value: m.status },
          { Field: "Started", Value: new Date(m.startTime).toLocaleString() },
          { Field: "Ended", Value: m.endTime ? new Date(m.endTime).toLocaleString() : "—" },
          { Field: "Duration", Value: formatDuration(report.durationSeconds ?? 0) },
          { Field: "Total participants", Value: report.participants.length },
          { Field: "Present at export", Value: present },
          { Field: "Attendance rate", Value: `${Math.round((present / total) * 100)}%` },
          { Field: "Open to everyone", Value: m.openToEveryone === false ? "No (private)" : "Yes" },
        ]),
        "Summary",
      );

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          report.participants.map((p: any) => ({
            Name: displayName(p.user),
            Email: p.user.email ?? "",
            Role: p.role,
            Status: p.status ?? "active",
            "Joined at": p.joinedAt ? new Date(p.joinedAt).toLocaleString() : "",
            "Left at": p.leftAt ? new Date(p.leftAt).toLocaleString() : !p.leftAt && p.status !== "waiting" ? "Still in call" : "—",
            "Time in call": p.joinedAt ? formatDuration(Math.max(0, ((p.leftAt ?? Date.now()) - p.joinedAt) / 1000)) : "",
            Muted: p.isMuted ? "Yes" : "No",
            "Camera on": p.isVideoOn === false ? "No" : "Yes",
            "Raised hand": p.hasRaisedHand ? "Yes" : "No",
          })),
        ),
        "Attendance",
      );

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          report.participants.map((p: any) => ({
            Name: displayName(p.user),
            Email: p.user.email ?? "",
            "Chat messages": p.chatMessages ?? 0,
            Reactions: p.reactionsSent ?? 0,
            "Screen shares": p.screenShares ?? 0,
            "Mute toggles": p.muteToggles ?? 0,
            "Camera toggles": p.cameraToggles ?? 0,
            "Hand raises": p.handRaises ?? 0,
            "Poll votes": p.pollVotes ?? 0,
          })),
        ),
        "Activities",
      );

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          report.events.map((e: any) => ({
            Time: new Date(e.at).toLocaleString(),
            User: e.user ? displayName(e.user) : "Unknown",
            Activity: e.type.replace(/_/g, " "),
            Detail: e.detail ?? "",
          })),
        ),
        "Activity timeline",
      );

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          report.chat
            .filter((msg: any) => msg.kind !== "system")
            .map((msg: any) => ({
              Time: new Date(msg.createdAt).toLocaleString(),
              Sender: msg.sender ? displayName(msg.sender) : "Unknown",
              Message: msg.body ?? "",
              Kind: msg.kind,
            })),
        ),
        "Chat log",
      );

      XLSX.writeFile(wb, `shine-meeting-report-${m.roomCode}.xlsx`);
      toast("Report downloaded");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to generate report");
    }
  };

  // loading (or resolving a pretty code link)
  if (!detail) {
    // a code link that resolved to nothing → meeting not found
    if (routeCode && !routeId && byCode === null) {
      return (
        <div className="grid min-h-screen place-items-center bg-background p-4 text-muted-foreground">
          <div className="glass-strong hairline w-full max-w-md rounded-3xl p-8 text-center shadow-2xl">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-rose-500/10 text-rose-400">
              <X className="size-6" />
            </div>
            <h2 className="mt-5 text-xl font-bold tracking-tight">Meeting not found</h2>
            <p className="mt-2 text-sm leading-6">
              No meeting matches this link. It may have been cancelled, or the code is
              incorrect. Check the room code and try again.
            </p>
            <Button
              className="mt-6 h-11 w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => navigate("/meet")}
            >
              <LogOut className="size-4" /> Return to Meet
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        <div className="text-center">
          <Loader2 className="mx-auto size-6 animate-spin" />
          <p className="mt-2 text-sm">Loading meeting…</p>
        </div>
      </div>
    );
  }

  const { meeting, host, conversationId } = detail;
  const meetingMessages = (messagesPage?.messages ?? []) as any[];
  const anyReconnecting = peerIds.some((p) => peerStates[p] === "reconnecting");
  const connectedPeers = peerIds.filter((p) => peerStates[p] === "connected").length;

  // ---- DENIED / REMOVED ------------------------------------------------------
  if (amDenied) {
    return (
      <div className="relative grid min-h-screen place-items-center overflow-hidden bg-background p-4">
        <div className="glass-strong hairline relative w-full max-w-md rounded-3xl p-8 text-center shadow-2xl">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-rose-500/10 text-rose-400">
            <X className="size-6" />
          </div>
          <h2 className="mt-5 text-xl font-bold tracking-tight">You weren't let in</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            The host didn't admit you to this meeting. You can wait, or return to Meet.
          </p>
          <Button
            className="mt-6 h-11 w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => navigate("/meet")}
          >
            <LogOut className="size-4" /> Return to Meet
          </Button>
        </div>
      </div>
    );
  }

  // ---- WAITING ROOM (lobby admission) ----------------------------------------
  if (!joined && amWaiting) {
    return (
      <div className="relative grid min-h-screen place-items-center overflow-hidden bg-background p-4">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-[420px] w-[700px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,var(--gold-soft),transparent_65%)] blur-3xl" />
        </div>
        <div className="glass-strong hairline relative w-full max-w-md overflow-hidden rounded-3xl shadow-2xl">
          <div className="flex items-center gap-2 border-b border-border/70 px-5 py-3">
            <DoorOpen className="size-4 text-primary" />
            <span className="text-sm font-semibold">Waiting room</span>
          </div>
          <div className="p-6 text-center">
            <div className="relative mx-auto aspect-video w-full max-w-xs overflow-hidden rounded-2xl border border-border/70 bg-black/50">
              {localStream ? (
                <video ref={bindLocalVideo} autoPlay playsInline muted className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-muted-foreground">
                  <Video className="size-6" />
                </div>
              )}
            </div>
            <h2 className="mt-5 text-lg font-bold tracking-tight">Waiting for the host…</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              The host will let you in shortly. Your mic & camera stay off until you're admitted.
            </p>
            <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" />
              <span className="flex items-center gap-1 text-primary">
                <ShieldCheck className="size-3.5" /> Host controls admission
              </span>
            </div>
            <Button
              variant="outline"
              className="mt-6 h-11 w-full gap-2"
              onClick={() => navigate("/meet")}
            >
              <LogOut className="size-4" /> Leave waiting room
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ---- LOBBY ---------------------------------------------------------------
  if (!joined) {
    return (
      <div className="relative grid min-h-screen place-items-center overflow-hidden bg-background p-4">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-[420px] w-[700px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,var(--gold-soft),transparent_65%)] blur-3xl" />
        </div>
        <div className="relative w-full max-w-3xl">
          <div className="mb-6 text-center">
            <div className="text-2xl font-bold tracking-tight">{meeting.title}</div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
              <Badge className="bg-accent text-muted-foreground">Room {meeting.roomCode}</Badge>
              {meeting.openToEveryone === false ? (
                <Badge className="gap-1 border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/10">
                  <Lock className="size-3" /> Private — invite only
                </Badge>
              ) : (
                <Badge className="gap-1 border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/10">
                  <Unlock className="size-3" /> Open to everyone
                </Badge>
              )}
              {host && <span>Hosted by {displayName(host)}</span>}
              <span>·</span>
              <span>{meeting.status === "live" ? "In progress" : "Scheduled"}</span>
              {isChildRoom && (
                <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Breakout room</Badge>
              )}
              {meeting.lobbyEnabled && (
                <Badge className="gap-1 bg-amber-400/15 text-amber-300 hover:bg-amber-400/15">
                  <DoorOpen className="size-3" /> Waiting room on
                </Badge>
              )}
              {meeting.locked && (
                <Badge className="gap-1 bg-rose-500/15 text-rose-300 hover:bg-rose-500/15">
                  <Lock className="size-3" /> Locked
                </Badge>
              )}
            </div>
          </div>

          <div className="glass-strong hairline overflow-hidden rounded-3xl shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-3">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Video className="size-4 text-primary" /> Ready to join?
              </span>
              <Button variant="ghost" size="icon-sm" onClick={() => navigate("/meet")}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {/* preview */}
              <div className="relative aspect-video overflow-hidden rounded-2xl border border-border/70 bg-black/50">
                {localStream ? (
                  <video ref={bindLocalVideo} autoPlay playsInline muted className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center">
                    <div className="text-center text-muted-foreground">
                      <Video className="mx-auto mb-2 size-8" />
                      <p className="text-xs">Camera preview appears here</p>
                    </div>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 flex gap-1.5">
                  <button
                    onClick={toggleMic}
                    className={cn("grid size-8 place-items-center rounded-lg transition-colors", micOn ? "bg-black/50 text-white" : "bg-rose-500 text-white")}
                    title={micOn ? "Mute" : "Unmute"}
                  >
                    {micOn ? <Mic className="size-4" /> : <MicOff className="size-4" />}
                  </button>
                  <button
                    onClick={toggleCam}
                    className={cn("grid size-8 place-items-center rounded-lg transition-colors", camOn ? "bg-black/50 text-white" : "bg-rose-500 text-white")}
                    title={camOn ? "Camera off" : "Camera on"}
                  >
                    {camOn ? <Video className="size-4" /> : <VideoOff className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col justify-center gap-3">
                {mediaError && (
                  <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-2 text-xs text-amber-400">
                    {mediaError}
                  </p>
                )}
                <div className="text-sm text-muted-foreground">
                  {meeting.password ? "This meeting is protected by a password." : "No password required for this meeting."}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="size-4" />
                  {activeParticipants.length} {isWebinar ? "watching" : "in the meeting"}
                  {waitingParticipants.length > 0 && canManage && (
                    <span className="flex items-center gap-1 text-amber-300">
                      <DoorOpen className="size-3" /> {waitingParticipants.length} waiting
                    </span>
                  )}
                  {connectedPeers > 0 && (
                    <span className="flex items-center gap-1 text-emerald-500">
                      <Wifi className="size-3" /> {connectedPeers} connected
                    </span>
                  )}
                </div>
                {rtcConfig?.iceServers?.length === 0 && (
                  <p className="rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-[11px] text-primary">
                    TURN relay not configured — calls work best on open networks. Add
                    TURN_URL / TURN_USERNAME / TURN_PASSWORD in Keys for full NAT traversal.
                  </p>
                )}
                {isViewer && (
                  <p className="rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-xs text-primary">
                    You're joining as a <span className="font-semibold">viewer</span> — the host
                    broadcasts, you watch & chat.
                  </p>
                )}
                <Button
                  size="lg"
                  className="mt-2 h-12 bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={handleJoin}
                >
                  <Video className="size-4" />
                  {isWebinar
                    ? isHost
                      ? meeting.status === "scheduled"
                        ? "Start the webinar"
                        : "Broadcast now"
                      : "Join as viewer"
                    : isHost && meeting.status === "scheduled"
                      ? "Start the meeting"
                      : meeting.lobbyEnabled
                        ? "Ask to join"
                        : "Join meeting"}
                </Button>
                <p className="text-center text-[10px] text-muted-foreground">
                  <ShieldCheck className="mr-1 inline size-3" />
                  WebRTC DTLS-SRTP encrypted media · STUN + TURN relay
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- IN MEETING -----------------------------------------------------------
  return (
    <div className="relative flex h-svh flex-col overflow-hidden bg-[#050505] text-white">
      {/* top bar */}
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4">
        <div className="flex min-w-0 items-center gap-2">
          {isWebinar && (
            <Badge className="bg-amber-400/15 text-amber-300 hover:bg-amber-400/15">Webinar</Badge>
          )}
          {isChildRoom && (
            <Badge className="gap-1 bg-primary/20 text-primary hover:bg-primary/20">
              <LayoutGrid className="size-3" /> Breakout
            </Badge>
          )}
          <span className="truncate text-sm font-semibold">{meeting.title}</span>
          <Badge className="bg-white/10 text-white/70 hover:bg-white/10">
            <span className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-rose-400" />
            {formatDuration(elapsed)}
          </Badge>
        </div>
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-white/50">
          {/* connection quality */}
          {anyReconnecting ? (
            <span className="flex items-center gap-1 text-amber-300">
              <WifiOff className="size-3 animate-pulse" /> Reconnecting…
            </span>
          ) : connectedPeers > 0 ? (
            <span className="flex items-center gap-1 text-emerald-400">
              <Wifi className="size-3" /> {connectedPeers}/{peerIds.length} peers
            </span>
          ) : peerIds.length > 0 ? (
            <span className="flex items-center gap-1 text-white/40">
              <WifiOff className="size-3" /> Connecting…
            </span>
          ) : null}
          {isChildRoom && (
            <Button
              size="sm"
              className="ml-1 h-7 gap-1 rounded-lg bg-primary px-2.5 text-[11px] text-primary-foreground hover:bg-primary/90"
              onClick={handleReturnToMain}
            >
              <Users className="size-3" /> Return to main meeting
            </Button>
          )}
          {!isChildRoom && breakoutsActive && stayInMainRef.current && myBreakout?.childMeetingId && (
            <Button
              size="sm"
              className="ml-1 h-7 gap-1 rounded-lg bg-amber-400 px-2.5 text-[11px] font-semibold text-black hover:bg-amber-300"
              onClick={handleRejoinBreakout}
            >
              <LayoutGrid className="size-3" /> Rejoin my breakout
            </Button>
          )}
          <span className="ml-2 hidden sm:inline">Room {meeting.roomCode}</span>
          {recording && (
            <span className="ml-2 flex items-center gap-1 text-rose-400">
              <Radio className="size-3 animate-pulse" /> REC
            </span>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* video stage */}
        <div className="relative min-w-0 flex-1">
          <div
            className={cn(
              "grid h-full gap-2 p-3",
              peerIds.length === 0 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2",
            )}
          >
            {/* remote tiles */}
            {peerIds.map((pid) => {
              const p = activeParticipants.find((pp) => pp.user._id === pid);
              return (
                <RemoteTile
                  key={pid}
                  pid={pid}
                  participant={p}
                  stream={remoteStreams[pid]}
                  state={peerStates[pid] ?? "connecting"}
                />
              );
            })}
            {/* self tile */}
            <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black/60">
              {localStream ? (
                <video ref={bindLocalVideo} autoPlay playsInline muted className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-white/40">
                  <VideoOff className="size-8" />
                </div>
              )}
              <div className="absolute bottom-2 left-2 flex items-center gap-2">
                <span className="rounded-md bg-black/60 px-2 py-0.5 text-[11px] backdrop-blur">
                  {isViewer ? "You (viewing)" : `You ${sharing ? "(sharing screen)" : ""}`}
                </span>
                {isViewer && (
                  <span className="rounded-md bg-amber-400/90 px-2 py-0.5 text-[10px] font-semibold text-black">
                    Viewer
                  </span>
                )}
                {isModerator && (
                  <span className="rounded-md bg-sky-400/90 px-2 py-0.5 text-[10px] font-semibold text-black">
                    Co-host
                  </span>
                )}
                {handRaised && (
                  <span className="grid size-6 place-items-center rounded-md bg-amber-400 text-black">
                    <Hand className="size-3.5" />
                  </span>
                )}
              </div>
              {!micOn && !isViewer && (
                <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-lg bg-rose-500/90">
                  <MicOff className="size-3.5" />
                </span>
              )}
            </div>
          </div>

          {/* captions */}
          {captions && (
            <div className="absolute bottom-3 left-1/2 w-[80%] max-w-lg -translate-x-1/2">
              <div className="glass-strong rounded-xl px-3 py-2 text-center text-sm text-white">
                {captionText || "Listening…"}
              </div>
            </div>
          )}
        </div>

        {/* right panel — desktop */}
        <div className="hidden w-80 shrink-0 flex-col border-l border-white/10 bg-black/30 sm:flex">
          <PanelHeader
            panel={rightPanel}
            setPanel={setRightPanel}
            participantCount={activeParticipants.length}
            waitingCount={waitingParticipants.length}
          />
          {rightPanel === "chat" ? (
            <ChatPanel
              messages={meetingMessages}
              myId={myId}
              canManage={canManage}
              onSend={async (body) => {
                if (conversationId) {
                  await sendMsg({ conversationId: conversationId as any, body, kind: "text" }).catch(() => {});
                }
              }}
              onVote={async (messageId, optionId) => {
                await votePoll({ messageId: messageId as any, optionId }).catch((e) => toast(e.message));
              }}
              onClosePoll={async (messageId) => {
                await closePoll({ messageId: messageId as any }).catch((e) => toast(e.message));
              }}
              onOpenPoll={() => setPollOpen(true)}
            />
          ) : (
            <PeoplePanel
              participants={activeParticipants}
              waiting={waitingParticipants}
              myId={myId}
              isHost={isHost}
              canManage={canManage}
              meeting={meeting}
              onMute={(uid) => setParticipantMuted(uid, true)}
              onAdmit={handleAdmit}
              onAdmitAll={handleAdmitAll}
              onRemove={handleRemove}
              onSetRole={handleSetRole}
              onMuteAll={handleMuteAll}
              onToggleLock={() => {
                if (id) setLocked({ meetingId: id as any, locked: !meeting.locked }).catch((e) => toast(e.message));
              }}
              onToggleLobby={() => {
                if (id) setLobbyEnabled({ meetingId: id as any, enabled: !meeting.lobbyEnabled }).catch((e) => toast(e.message));
              }}
              onInvite={handleInvite}
              onBreakouts={() => setBreakoutOpen(true)}
              onPoll={() => setPollOpen(true)}
            />
          )}
        </div>
      </div>

      {/* controls */}
      <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-t border-white/10 px-2 py-3">
        {!isViewer && (
          <>
            <ControlBtn active={micOn} onClick={toggleMic} title={micOn ? "Mute (M)" : "Unmute (M)"}>
              {micOn ? <Mic className="size-5" /> : <MicOff className="size-5 text-rose-400" />}
            </ControlBtn>
            <ControlBtn active={camOn} onClick={toggleCam} title={camOn ? "Camera off (V)" : "Camera on (V)"}>
              {camOn ? <Video className="size-5" /> : <VideoOff className="size-5 text-rose-400" />}
            </ControlBtn>
            <ControlBtn active={!sharing} onClick={toggleShare} title={sharing ? "Stop sharing" : "Share screen (S)"} gold={sharing}>
              {sharing ? <ScreenShare className="size-5" /> : <MonitorUp className="size-5" />}
            </ControlBtn>
          </>
        )}
        {isViewer && (
          <span className="mr-1 flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/60">
            <MonitorUp className="size-3.5" /> Viewer mode
          </span>
        )}
        <ControlBtn active={!handRaised} onClick={toggleHand} title="Raise hand (R)" gold={handRaised}>
          <Hand className="size-5" />
        </ControlBtn>
        <ControlBtn active={!captions} onClick={toggleCaptions} title="Live captions (C)">
          <Captions className="size-5" />
        </ControlBtn>
        {isHost && !isChildRoom && (
          <ControlBtn
            active={!recording}
            onClick={toggleRecord}
            title={recording ? "Stop recording" : "Record this meeting"}
          >
            <Radio className={cn("size-5", recording && "animate-pulse text-rose-400")} />
          </ControlBtn>
        )}
        {canManage && !isChildRoom && (
          <>
            <ControlBtn active={false} onClick={() => setPollOpen(true)} title="Create a poll">
              <BarChart3 className="size-5" />
            </ControlBtn>
            <ControlBtn active={false} onClick={() => setBreakoutOpen(true)} title="Breakout rooms">
              <LayoutGrid className="size-5" />
            </ControlBtn>
            <ControlBtn active={false} onClick={() => setReportOpen(true)} title="Meeting report (Excel)">
              <FileSpreadsheet className="size-5" />
            </ControlBtn>
          </>
        )}
        <ReactionsPopover
          onPick={(e) => {
            if (conversationId) {
              sendMsg({ conversationId: conversationId as any, body: e, kind: "text" }).catch(() => {});
            }
          }}
        />
        {/* mobile panel toggle */}
        <button
          className="grid size-11 place-items-center rounded-xl bg-white/10 text-white transition-colors hover:bg-white/15 sm:hidden"
          onClick={() => setRightPanel((p) => (p === null ? "chat" : null))}
          title="Chat & people"
        >
          <MessageSquare className="size-5" />
        </button>
        <Button className="ml-1 gap-2 rounded-xl bg-rose-500 px-4 text-white hover:bg-rose-500" onClick={handleLeave}>
          <PhoneOff className="size-4" /> {isChildRoom ? "Return" : "Leave"}
        </Button>
        {isHost && !isChildRoom && (
          <Button
            variant="outline"
            className="gap-2 rounded-xl border-rose-400/40 text-rose-300 hover:bg-rose-500/10"
            onClick={handleEnd}
          >
            <X className="size-4" /> End for all
          </Button>
        )}
      </div>

      {/* mobile side panel (overlay drawer) */}
      <AnimatePresence>
        {rightPanel && (
          <motion.div
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="absolute inset-y-0 right-0 z-40 flex w-[88%] max-w-sm flex-col border-l border-white/10 bg-[#0b0b0b] sm:hidden"
          >
            <PanelHeader
              panel={rightPanel}
              setPanel={setRightPanel}
              participantCount={activeParticipants.length}
              waitingCount={waitingParticipants.length}
              onClose={() => setRightPanel(null)}
            />
            {rightPanel === "chat" ? (
              <ChatPanel
                messages={meetingMessages}
                myId={myId}
                canManage={canManage}
                onSend={async (body) => {
                  if (conversationId) {
                    await sendMsg({ conversationId: conversationId as any, body, kind: "text" }).catch(() => {});
                  }
                  track("chat_message", body.slice(0, 80));
                }}
                onVote={async (messageId, optionId) => {
                  await votePoll({ messageId: messageId as any, optionId }).catch((e) => toast(e.message));
                }}
                onClosePoll={async (messageId) => {
                  await closePoll({ messageId: messageId as any }).catch((e) => toast(e.message));
                }}
                onOpenPoll={() => setPollOpen(true)}
              />
            ) : (
              <PeoplePanel
                participants={activeParticipants}
                waiting={waitingParticipants}
                myId={myId}
                isHost={isHost}
                canManage={canManage}
                meeting={meeting}
                onMute={(uid) => setParticipantMuted(uid, true)}
                onAdmit={handleAdmit}
                onAdmitAll={handleAdmitAll}
                onRemove={handleRemove}
                onSetRole={handleSetRole}
                onMuteAll={handleMuteAll}
                onToggleLock={() => {
                  if (id) setLocked({ meetingId: id as any, locked: !meeting.locked }).catch((e) => toast(e.message));
                }}
                onToggleLobby={() => {
                  if (id) setLobbyEnabled({ meetingId: id as any, enabled: !meeting.lobbyEnabled }).catch((e) => toast(e.message));
                }}
                onInvite={handleInvite}
                onBreakouts={() => setBreakoutOpen(true)}
                onPoll={() => setPollOpen(true)}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* host tools — breakout rooms + polls */}
      <BreakoutDialog
        open={breakoutOpen}
        onOpenChange={setBreakoutOpen}
        meeting={meeting}
        participants={activeParticipants}
        onSaveRooms={(names, durationMinutes) => {
          if (id) createBreakoutRooms({ meetingId: id as any, names, durationMinutes }).catch((e) => toast(e.message));
        }}
        onAssign={(userId, roomId) => {
          if (id) assignToBreakout({ meetingId: id as any, userId: userId as any, roomId }).catch((e) => toast(e.message));
        }}
        onStart={() => {
          if (id) startBreakouts({ meetingId: id as any }).then(() => toast("Breakout rooms started")).catch((e) => toast(e.message));
        }}
        onEnd={() => {
          if (id) endBreakouts({ meetingId: id as any }).then(() => toast("Breakout rooms ended — everyone returned")).catch((e) => toast(e.message));
        }}
        onEnter={handleEnterBreakout}
      />
      <PollDialog
        open={pollOpen}
        onOpenChange={setPollOpen}
        onCreate={handleCreatePoll}
      />
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        report={reportData}
        onDownload={handleDownloadReport}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Remote video tile — binds its own <video> via a ref, no DOM queries.       */
/* -------------------------------------------------------------------------- */
function RemoteTile({
  pid,
  participant,
  stream,
  state,
}: {
  pid: string;
  participant: { user: any; role?: string; status?: string; hasRaisedHand?: boolean; isMuted?: boolean; isVideoOn?: boolean } | undefined;
  stream?: MediaStream;
  state: PeerState;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  // host-mute enforcement: mute the remote audio element when the participant
  // is muted (self-mute or host-mute — both show as isMuted on the row)
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = !!participant?.isMuted;
    }
  }, [participant?.isMuted, stream]);

  const showPlaceholder = !stream || state === "failed";
  const connecting = !stream && state !== "failed";
  const reconnecting = state === "reconnecting";

  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black/60">
      <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
      {showPlaceholder && (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-zinc-800 to-zinc-950 text-xs text-white/40">
          {participant ? <UserAvatar user={participant.user} size="xl" /> : "Connecting…"}
        </div>
      )}
      {connecting && (
        <div className="absolute inset-0 grid place-items-center bg-black/40">
          <div className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white/70 backdrop-blur">
            <Loader2 className="size-3.5 animate-spin" /> Connecting…
          </div>
        </div>
      )}
      {reconnecting && (
        <div className="absolute inset-0 grid place-items-center bg-black/40">
          <div className="flex items-center gap-2 rounded-full bg-amber-400/20 px-3 py-1.5 text-xs text-amber-300 backdrop-blur">
            <WifiOff className="size-3.5 animate-pulse" /> Reconnecting…
          </div>
        </div>
      )}
      {state === "failed" && (
        <div className="absolute inset-0 grid place-items-center bg-black/40">
          <div className="flex items-center gap-2 rounded-full bg-rose-500/20 px-3 py-1.5 text-xs text-rose-300 backdrop-blur">
            <WifiOff className="size-3.5" /> Couldn't connect
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-0.5 text-[11px] backdrop-blur">
          {participant ? <UserAvatar user={participant.user} size="xs" /> : null}
          {participant ? displayName(participant.user) : "Participant"}
        </span>
        {participant?.role === "host" && (
          <span className="grid size-5 place-items-center rounded-md bg-amber-400 text-black" title="Host">
            <Crown className="size-3" />
          </span>
        )}
        {participant?.role === "moderator" && (
          <span className="grid size-5 place-items-center rounded-md bg-sky-400 text-black" title="Co-host">
            <ShieldCheck className="size-3" />
          </span>
        )}
        {participant?.hasRaisedHand && (
          <span className="grid size-6 place-items-center rounded-md bg-amber-400 text-black" title="Hand raised">
            <Hand className="size-3.5" />
          </span>
        )}
        {participant?.isMuted && stream && (
          <span className="grid size-6 place-items-center rounded-md bg-black/60 text-rose-400 backdrop-blur">
            <MicOff className="size-3" />
          </span>
        )}
      </div>
      {state === "connected" && (
        <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-md bg-emerald-500/20 text-emerald-400">
          <Wifi className="size-3" />
        </span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
function PanelHeader({
  panel,
  setPanel,
  participantCount,
  waitingCount = 0,
  onClose,
}: {
  panel: "chat" | "people" | null;
  setPanel: (p: "chat" | "people" | null) => void;
  participantCount: number;
  waitingCount?: number;
  onClose?: () => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-white/10 px-3 py-2">
      <Button
        variant="ghost"
        size="sm"
        className={cn("h-8 text-xs", panel === "chat" && "bg-white/10 text-white")}
        onClick={() => setPanel("chat")}
      >
        <MessageSquare className="size-3.5" /> Chat
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn("h-8 text-xs", panel === "people" && "bg-white/10 text-white")}
        onClick={() => setPanel("people")}
      >
        <Users className="size-3.5" /> People ({participantCount}
        {waitingCount > 0 && <span className="text-amber-300">+{waitingCount}</span>})
      </Button>
      <div className="flex-1" />
      {onClose && (
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}

function ChatPanel({
  messages,
  myId,
  canManage,
  onSend,
  onVote,
  onClosePoll,
  onOpenPoll,
}: {
  messages: any[];
  myId: string;
  canManage: boolean;
  onSend: (body: string) => Promise<void>;
  onVote: (messageId: string, optionId: string) => Promise<void>;
  onClosePoll: (messageId: string) => Promise<void>;
  onOpenPoll: () => void;
}) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  const send = async () => {
    if (!text.trim()) return;
    await onSend(text.trim());
    setText("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {messages
          .filter((m) => !m.deleted)
          .map((m) =>
            m.kind === "poll" && m.poll ? (
              <PollCard
                key={m._id}
                message={m}
                myId={myId}
                canManage={canManage}
                onVote={onVote}
                onClose={onClosePoll}
              />
            ) : (
              <div
                key={m._id}
                className={cn(
                  "max-w-[90%] rounded-xl px-3 py-2 text-xs leading-5",
                  m.senderId === myId ? "ml-auto bg-white/10" : "bg-white/5",
                )}
              >
                <div className="mb-0.5 flex items-center gap-1.5 text-[10px] text-white/40">
                  {m.sender ? displayName(m.sender) : "Unknown"}
                  {m.kind === "system" ? "· system" : ""}
                </div>
                {m.body}
              </div>
            ),
          )}
        {messages.length === 0 && (
          <p className="py-8 text-center text-xs text-white/30">Say hi 👋</p>
        )}
      </div>
      <div className="flex items-end gap-2 border-t border-white/10 p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message everyone…"
          className="h-10 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        {canManage && (
          <Button
            size="icon"
            className="size-10 shrink-0 bg-white/10 text-white hover:bg-white/15"
            onClick={onOpenPoll}
            title="Create a poll"
          >
            <BarChart3 className="size-4" />
          </Button>
        )}
        <Button
          size="icon"
          className="size-10 shrink-0 bg-amber-400 text-black hover:bg-amber-400"
          onClick={send}
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Poll card — vote once, live tallies for hosts, closes to final results.    */
/* -------------------------------------------------------------------------- */
function PollCard({
  message,
  myId,
  canManage,
  onVote,
  onClose,
}: {
  message: any;
  myId: string;
  canManage: boolean;
  onVote: (messageId: string, optionId: string) => Promise<void>;
  onClose: (messageId: string) => Promise<void>;
}) {
  const poll = message.poll;
  const myVote = poll.options.find((o: any) => o.votes.includes(myId))?.id ?? null;
  const total = poll.options.reduce((s: number, o: any) => s + o.votes.length, 0);
  const isCreator = message.senderId === myId;
  // live results are visible to EVERYONE in real time — no hiding until you vote
  const showResults = true;
  const [voting, setVoting] = useState<string | null>(null);

  return (
    <div className="w-[280px] max-w-full rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-semibold text-white">
          <BarChart3 className="size-3.5 text-amber-400" /> {poll.question}
        </span>
        {poll.closed ? (
          <Badge className="shrink-0 bg-white/10 text-white/60 hover:bg-white/10">Closed</Badge>
        ) : (
          <Badge className="shrink-0 border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/10">
            Live
          </Badge>
        )}
      </div>
      <div className="mt-2 space-y-1.5">
        {poll.options.map((o: any) => {
          const pct = total ? Math.round((o.votes.length / total) * 100) : 0;
          const chosen = o.id === myVote;
          const voters = (o.voterNames ?? []) as string[];
          return (
            <div key={o.id} className="relative overflow-hidden rounded-lg border px-3 py-2">
              <div
                className="absolute inset-y-0 left-0 bg-amber-400/15 transition-all duration-300"
                style={{ width: showResults ? `${pct}%` : "0%" }}
              />
              <div className="relative">
                <button
                  disabled={poll.closed || voting !== null}
                  onClick={async () => {
                    setVoting(o.id);
                    await onVote(message._id, o.id);
                    setVoting(null);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 text-left",
                    chosen ? "font-semibold text-amber-300" : "text-white/90",
                    poll.closed && "cursor-default",
                  )}
                >
                  <span>{o.text}</span>
                  <span className="shrink-0 text-[10px] text-amber-300">
                    {o.votes.length}
                    {total ? ` · ${pct}%` : ""}
                  </span>
                </button>
                {/* the poll creator (and hosts) see exactly who voted — updates live */}
                {(isCreator || canManage) && voters.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {voters.map((name, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] text-white/60"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-white/40">
          {total} vote{total === 1 ? "" : "s"}
          {myVote && !poll.closed ? " · you voted" : ""}
        </span>
        {(canManage || isCreator) && !poll.closed && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 border-white/15 px-2 text-[10px] text-white/70 hover:bg-white/10"
            onClick={() => onClose(message._id)}
          >
            Close poll
          </Button>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
function PeoplePanel({
  participants,
  waiting,
  myId,
  isHost,
  canManage,
  meeting,
  onMute,
  onAdmit,
  onAdmitAll,
  onRemove,
  onSetRole,
  onMuteAll,
  onToggleLock,
  onToggleLobby,
  onInvite,
  onBreakouts,
  onPoll,
}: {
  participants: any[];
  waiting: any[];
  myId: string;
  isHost: boolean;
  canManage: boolean;
  meeting: any;
  onMute: (userId: string) => void;
  onAdmit: (userId: string, admit: boolean) => void;
  onAdmitAll: () => void;
  onRemove: (userId: string) => void;
  onSetRole: (userId: string, role: "moderator" | "participant") => void;
  onMuteAll: () => void;
  onToggleLock: () => void;
  onToggleLobby: () => void;
  onInvite: () => void;
  onBreakouts: () => void;
  onPoll: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
        {/* waiting room section */}
        {waiting.length > 0 && (
          <div className="mb-2">
            <div className="mb-1 flex items-center justify-between px-1">
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300/90">
                <DoorOpen className="size-3" /> Waiting ({waiting.length})
              </span>
              {canManage && (
                <button onClick={onAdmitAll} className="text-[10px] font-medium text-amber-300 hover:underline">
                  Admit all
                </button>
              )}
            </div>
            {waiting.map((p) => (
              <div key={p._id} className="flex items-center gap-2.5 rounded-xl border border-amber-400/15 bg-amber-400/5 p-2">
                <UserAvatar user={p.user} size="sm" showStatus />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{displayName(p.user)}</div>
                  <div className="text-[10px] text-amber-300/70">Waiting to join</div>
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      className="h-7 gap-1 bg-amber-400 px-2 text-[10px] font-semibold text-black hover:bg-amber-400"
                      onClick={() => onAdmit(p.user._id, true)}
                    >
                      <Check className="size-3" /> Admit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 border-rose-400/40 px-2 text-[10px] text-rose-300 hover:bg-rose-500/10"
                      onClick={() => onAdmit(p.user._id, false)}
                    >
                      <X className="size-3" /> Deny
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {participants.map((p) => (
          <div
            key={p._id}
            className="group flex items-center gap-2.5 rounded-xl p-2 transition-colors hover:bg-white/5"
          >
            <UserAvatar user={p.user} size="sm" showStatus />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-sm">
                <span className="truncate">{displayName(p.user)}</span>
                {p.role === "host" && (
                  <Badge className="bg-amber-400/15 text-amber-300 hover:bg-amber-400/15">Host</Badge>
                )}
                {p.role === "moderator" && (
                  <Badge className="bg-sky-400/15 text-sky-300 hover:bg-sky-400/15">Co-host</Badge>
                )}
                {p.user._id === myId && <span className="text-[10px] text-white/40">(you)</span>}
              </div>
              {p.hasRaisedHand && <div className="text-[11px] text-amber-300">✋ raised hand</div>}
            </div>
            <div className="flex items-center gap-1 text-white/50">
              {p.isVideoOn === false && <VideoOff className="size-3.5" />}
              {p.isMuted ? <MicOff className="size-3.5 text-rose-400" /> : <Mic className="size-3.5" />}
              {canManage && p.user._id !== myId && p.role !== "host" && !p.isMuted && (
                <button
                  onClick={() => onMute(p.user._id)}
                  className="ml-1 grid size-6 place-items-center rounded-md bg-white/5 text-rose-300 opacity-0 transition-opacity hover:bg-rose-500/20 group-hover:opacity-100"
                  title="Mute participant"
                >
                  <MicOff className="size-3" />
                </button>
              )}
              {canManage && p.user._id !== myId && p.role !== "host" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="ml-1 grid size-6 place-items-center rounded-md bg-white/5 opacity-0 transition-opacity hover:bg-white/15 group-hover:opacity-100"
                      title="More actions"
                    >
                      <Plus className="size-3 rotate-45" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 border-white/10 bg-zinc-900 text-white">
                    {isHost && p.role !== "moderator" && (
                      <DropdownMenuItem className="cursor-pointer text-xs" onClick={() => onSetRole(p.user._id, "moderator")}>
                        <ShieldCheck className="mr-2 size-3.5" /> Make co-host
                      </DropdownMenuItem>
                    )}
                    {isHost && p.role === "moderator" && (
                      <DropdownMenuItem className="cursor-pointer text-xs" onClick={() => onSetRole(p.user._id, "participant")}>
                        <ShieldCheck className="mr-2 size-3.5" /> Remove as co-host
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem className="cursor-pointer text-xs" onClick={() => onMute(p.user._id)}>
                      <MicOff className="mr-2 size-3.5" /> Mute
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer text-xs text-rose-300 focus:text-rose-300"
                      onClick={() => onRemove(p.user._id)}
                    >
                      <X className="mr-2 size-3.5" /> Remove from meeting
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        ))}
        {participants.length === 0 && waiting.length === 0 && (
          <p className="py-8 text-center text-xs text-white/30">No one else here yet</p>
        )}
      </div>

      {/* host tools */}
      {canManage && (
        <div className="border-t border-white/10 p-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <ToolIcon title="Mute all" onClick={onMuteAll}>
              <MicOff className="size-4" />
            </ToolIcon>
            <ToolIcon title={meeting?.locked ? "Unlock meeting" : "Lock meeting"} onClick={onToggleLock} active={!!meeting?.locked}>
              {meeting?.locked ? <Unlock className="size-4" /> : <Lock className="size-4" />}
            </ToolIcon>
            <ToolIcon title="Waiting room" onClick={onToggleLobby} active={!!meeting?.lobbyEnabled}>
              <DoorOpen className="size-4" />
            </ToolIcon>
            <ToolIcon title="Breakout rooms" onClick={onBreakouts} active={!!meeting?.breakoutsActive}>
              <LayoutGrid className="size-4" />
            </ToolIcon>
            <ToolIcon title="Create a poll" onClick={onPoll}>
              <BarChart3 className="size-4" />
            </ToolIcon>
            <ToolIcon title="Invite people" onClick={onInvite}>
              <UserPlus className="size-4" />
            </ToolIcon>
            <span className="ml-auto px-1 text-[9px] text-white/30">
              {meeting?.lobbyEnabled ? "Waiting room on" : meeting?.locked ? "Locked" : "Host tools"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolIcon({
  children,
  onClick,
  title,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "grid size-9 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white",
        active && "bg-amber-400/15 text-amber-300 hover:text-amber-300",
      )}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
function ControlBtn({
  children,
  onClick,
  title,
  active,
  gold,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active: boolean;
  gold?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "grid size-11 place-items-center rounded-xl transition-all hover:scale-105",
        active ? "bg-white/10 hover:bg-white/15" : "bg-white/10",
        gold ? "bg-amber-400 text-black hover:bg-amber-400" : "text-white",
      )}
    >
      {children}
    </button>
  );
}

function ReactionsPopover({ onPick }: { onPick: (e: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          title="React"
          className="grid size-11 place-items-center rounded-xl bg-white/10 text-white transition-all hover:scale-105 hover:bg-white/15"
        >
          <AudioLines className="size-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-auto border-white/10 bg-zinc-900 p-2">
        <div className="flex gap-1">
          {QUICK_REACTIONS.map((e) => (
            <button
              key={e}
              onClick={() => onPick(e)}
              className="rounded-lg p-1.5 text-xl transition-transform hover:scale-125"
            >
              {e}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* -------------------------------------------------------------------------- */
/* Breakout rooms manager — host/co-host only.                                 */
/* -------------------------------------------------------------------------- */
function BreakoutDialog({
  open,
  onOpenChange,
  meeting,
  participants,
  onSaveRooms,
  onAssign,
  onStart,
  onEnd,
  onEnter,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  meeting: any;
  participants: any[];
  onSaveRooms: (names: string[], durationMinutes?: number) => void;
  onAssign: (userId: string, roomId: string | undefined) => void;
  onStart: () => void;
  onEnd: () => void;
  onEnter: (childMeetingId: string) => void;
}) {
  const rooms: any[] = meeting?.breakoutRooms ?? [];
  const active = !!meeting?.breakoutsActive;
  const [name, setName] = useState("");
  const [timed, setTimed] = useState(false);
  const [minutes, setMinutes] = useState(10);
  const [nowTick, setNowTick] = useState(Date.now());
  const endsAt = meeting?.breakoutEndsAt as number | undefined;

  // countdown — ticks every second so timed breakouts visibly wind down
  useEffect(() => {
    if (!active || !endsAt) return;
    const iv = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [active, endsAt]);

  const remaining = endsAt ? Math.max(0, Math.ceil((endsAt - nowTick) / 1000)) : null;

  // when the timer hits zero, auto-return everyone (same as the backend sweep)
  useEffect(() => {
    if (active && endsAt && remaining !== null && remaining <= 0) {
      onEnd();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, endsAt, remaining]);

  const addRoom = () => {
    if (!name.trim()) return;
    onSaveRooms([...rooms.map((r) => r.name), name.trim()], timed ? minutes : undefined);
    setName("");
  };
  const removeRoom = (roomId: string) => {
    onSaveRooms(rooms.filter((r) => r.id !== roomId).map((r) => r.name), timed ? minutes : undefined);
  };

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-white/10 bg-zinc-950 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutGrid className="size-4 text-primary" /> Breakout rooms
          </DialogTitle>
        </DialogHeader>

        {active ? (
          <div className="space-y-3">
            <p className="rounded-lg border border-primary/25 bg-primary/10 p-3 text-xs text-primary">
              Breakout rooms are running. Assign more people to move them, or end
              breakouts to bring everyone back.
            </p>
            {endsAt ? (
              <div className="flex items-center justify-between rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2">
                <span className="flex items-center gap-1.5 text-xs text-amber-300">
                  <Clock className="size-3.5" /> Time remaining
                </span>
                <span className="font-mono text-sm font-bold text-amber-300">
                  {fmt(remaining ?? 0)}
                </span>
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
                <Clock className="mr-1.5 inline size-3.5" /> No time limit — runs until you end it.
              </div>
            )}
            {rooms.map((r) => (
              <RoomRow
                key={r.id}
                room={r}
                participants={participants}
                onAssign={onAssign}
                onEnter={r.childMeetingId ? () => onEnter(String(r.childMeetingId)) : undefined}
              />
            ))}
            <Button
              className="h-10 w-full gap-2 bg-rose-500 text-white hover:bg-rose-500"
              onClick={onEnd}
            >
              <X className="size-4" /> End breakouts — return everyone
            </Button>
          </div>
        ) : rooms.length === 0 ? (
          <div className="space-y-3">
            <p className="text-xs leading-5 text-muted-foreground">
              Create up to 8 breakout rooms. When you start them, assigned people move
              into their own video room and chat; the main meeting keeps running.
            </p>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRoom()}
                placeholder="Room name, e.g. Team Alpha"
                className="h-10 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
              />
              <Button className="h-10 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90" onClick={addRoom}>
                <Plus className="size-4" /> Add
              </Button>
            </div>
            <TimeLimitPicker
              timed={timed}
              setTimed={setTimed}
              minutes={minutes}
              setMinutes={setMinutes}
              onDurationChange={(t, m) => onSaveRooms(rooms.map((r) => r.name), t ? m : undefined)}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map((r) => (
              <RoomRow
                key={r.id}
                room={r}
                participants={participants}
                onAssign={onAssign}
                onRemove={() => removeRoom(r.id)}
              />
            ))}
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRoom()}
                placeholder="Add another room…"
                className="h-10 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
              />
              <Button className="h-10 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90" onClick={addRoom}>
                <Plus className="size-4" /> Add
              </Button>
            </div>
            <TimeLimitPicker
              timed={timed}
              setTimed={setTimed}
              minutes={minutes}
              setMinutes={setMinutes}
              onDurationChange={(t, m) => onSaveRooms(rooms.map((r) => r.name), t ? m : undefined)}
            />
            <Button className="h-10 w-full gap-2 bg-amber-400 text-black hover:bg-amber-400" onClick={onStart}>
              <LayoutGrid className="size-4" /> Start breakout rooms
            </Button>
          </div>
        )}
        {!active && (
          <DialogFooter className="pt-1">
            <Button variant="outline" className="border-white/10 text-white hover:bg-white/10" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* Timed vs no-time-limit selector shown while configuring breakout rooms. */
function TimeLimitPicker({
  timed,
  setTimed,
  minutes,
  setMinutes,
  onDurationChange,
}: {
  timed: boolean;
  setTimed: (v: boolean) => void;
  minutes: number;
  setMinutes: (v: number) => void;
  onDurationChange: (timed: boolean, minutes: number) => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-[11px] font-semibold text-white/70">Breakout duration</div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          onClick={() => {
            setTimed(false);
            onDurationChange(false, minutes);
          }}
          className={cn(
            "rounded-lg border px-2 py-2 text-xs transition-colors",
            !timed
              ? "border-primary/50 bg-primary/15 text-primary"
              : "border-white/10 text-white/60 hover:bg-white/5",
          )}
        >
          No time limit
        </button>
        <button
          onClick={() => {
            setTimed(true);
            onDurationChange(true, minutes);
          }}
          className={cn(
            "rounded-lg border px-2 py-2 text-xs transition-colors",
            timed
              ? "border-amber-400/60 bg-amber-400/15 text-amber-300"
              : "border-white/10 text-white/60 hover:bg-white/5",
          )}
        >
          Set a timer
        </button>
      </div>
      {timed && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={600}
            value={minutes}
            onChange={(e) => {
              const m = Math.max(1, Math.min(600, Number(e.target.value) || 1));
              setMinutes(m);
              onDurationChange(true, m);
            }}
            className="h-9 w-20 rounded-lg border border-white/10 bg-white/5 px-2 text-center text-sm text-white focus:border-white/30 focus:outline-none"
          />
          <span className="text-xs text-white/60">minutes</span>
          <span className="ml-auto text-[11px] text-white/40">
            Auto-returns everyone when the time is up
          </span>
        </div>
      )}
    </div>
  );
}

function RoomRow({
  room,
  participants,
  onAssign,
  onRemove,
  onEnter,
}: {
  room: any;
  participants: any[];
  onAssign: (userId: string, roomId: string | undefined) => void;
  onRemove?: () => void;
  onEnter?: () => void;
}) {
  const assignable = participants.filter((p) => String(p.user._id) !== String(room.hostId));
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{room.name}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-white/40">{room.participantIds?.length ?? 0} assigned</span>
          {onEnter && (
            <button
              onClick={onEnter}
              className="grid h-6 items-center gap-1 rounded-md bg-primary/20 px-2 text-[10px] font-semibold text-primary hover:bg-primary/30"
              title="Enter this breakout room"
            >
              <UserPlus className="size-3" /> Enter
            </button>
          )}
          {onRemove && (
            <button
              onClick={onRemove}
              className="grid size-6 place-items-center rounded-md bg-white/5 text-white/50 hover:bg-rose-500/20 hover:text-rose-300"
              title="Remove room"
            >
              <Minus className="size-3" />
            </button>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {(room.participantIds ?? []).map((uid: string) => {
          const p = participants.find((pp) => String(pp.user._id) === String(uid));
          return (
            <span key={uid} className="flex items-center gap-1 rounded-full bg-white/10 py-0.5 pl-1.5 pr-1 text-[10px]">
              {p ? displayName(p.user) : "…"}
              <button
                onClick={() => onAssign(String(uid), undefined)}
                className="grid size-4 place-items-center rounded-full bg-white/15 hover:bg-rose-500/30"
                title="Unassign"
              >
                <X className="size-2.5" />
              </button>
            </span>
          );
        })}
        {assignable.length > 0 && (
          <select
            value=""
            onChange={(e) => e.target.value && onAssign(e.target.value, room.id)}
            className="h-6 rounded-full border border-white/10 bg-zinc-900 px-2 text-[10px] text-white/70 focus:outline-none"
          >
            <option value="">+ assign…</option>
            {assignable.map((p) => (
              <option key={p.user._id} value={p.user._id}>
                {displayName(p.user)}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Poll creator — host/co-host only.                                           */
/* -------------------------------------------------------------------------- */
function PollDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreate: (question: string, options: string[]) => Promise<void>;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const q = question.trim();
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!q || opts.length < 2) {
      toast("Add a question and at least two options");
      return;
    }
    setBusy(true);
    try {
      await onCreate(q, opts);
      onOpenChange(false);
      setQuestion("");
      setOptions(["", ""]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-zinc-950 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="size-4 text-primary" /> Create a poll
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Question, e.g. Where should we eat?"
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
          />
          {options.map((o, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={o}
                onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={`Option ${i + 1}`}
                className="h-10 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
              />
              {options.length > 2 && (
                <button
                  onClick={() => setOptions(options.filter((_, j) => j !== i))}
                  className="grid size-10 place-items-center rounded-xl bg-white/5 text-white/50 hover:bg-rose-500/20 hover:text-rose-300"
                  title="Remove option"
                >
                  <Minus className="size-4" />
                </button>
              )}
            </div>
          ))}
          {options.length < 6 && (
            <button
              onClick={() => setOptions([...options, ""])}
              className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 text-xs text-white/60 hover:border-white/30 hover:text-white"
            >
              <Plus className="size-3.5" /> Add option
            </button>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" className="border-white/10 text-white hover:bg-white/10" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="gap-1.5 bg-amber-400 text-black hover:bg-amber-400"
            onClick={submit}
            disabled={busy}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <BarChart3 className="size-4" />} Launch poll
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
