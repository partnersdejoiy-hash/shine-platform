import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "convex/react";
import { useEffect } from "react";
import type { PresenceChoice } from "@/lib/presence";

const HEARTBEAT_MS = 25_000;
const IDLE_AFTER_MS = 5 * 60_000; // like Gmail: no typing, clicking or scrolling for 5 minutes = Away

/**
 * Keeps your presence fresh while Shine is open (Dejoiy Mail does the same, so
 * either app keeps you Active). Mount once (AppShell); other places only need
 * the setters below.
 */
export function usePresenceHeartbeat() {
  const { isAuthenticated, user } = useAuth();
  const heartbeat = useMutation(api.users.heartbeat);
  const goOffline = useMutation(api.users.goOffline);
  const registerDevice = useMutation(api.users.registerDevice);

  useEffect(() => {
    if (!isAuthenticated) return;
    const name = navigator.platform + " · " + (navigator.userAgent.includes("Mobile") ? "Mobile" : "Desktop");
    registerDevice({ name, platform: navigator.platform, isCurrent: true }).catch(() => {});

    let lastInput = Date.now();
    let wasIdle = false;
    const idle = () => document.hidden || Date.now() - lastInput > IDLE_AFTER_MS;
    const send = () => {
      wasIdle = idle();
      heartbeat({ idle: wasIdle }).catch(() => {});
    };
    const onInput = () => {
      lastInput = Date.now();
      if (wasIdle && !document.hidden) send(); // back from Away right away
    };
    send();
    const id = setInterval(send, HEARTBEAT_MS);
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, onInput, { passive: true }));
    document.addEventListener("visibilitychange", send);
    const onUnload = () => goOffline().catch(() => {});
    window.addEventListener("beforeunload", onUnload);
    return () => {
      clearInterval(id);
      events.forEach((e) => window.removeEventListener(e, onInput));
      document.removeEventListener("visibilitychange", send);
      window.removeEventListener("beforeunload", onUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?._id]);
}

/** Change how you show up, or your written status. */
export function usePresenceActions() {
  const setPresence = useMutation(api.users.setPresence);
  const setText = useMutation(api.users.setStatusText);
  return {
    setChoice: (choice: PresenceChoice) => setPresence({ choice }),
    setStatusText: (text: string) => setText({ text }),
  };
}
