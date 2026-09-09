import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "convex/react";
import { useEffect, useRef } from "react";
import type { PresenceStatus } from "@/lib/presence";

const HEARTBEAT_MS = 25_000;

/**
 * Module-level shared presence status. Multiple components mount this hook
 * (AppShell for the heartbeat, PresenceSelector for the status picker); they
 * must share ONE status source of truth or one instance silently overwrites
 * the other's selection back to "online" on every heartbeat.
 */
let sharedStatus: PresenceStatus = "online";

export function usePresenceHeartbeat() {
  const { isAuthenticated, user } = useAuth();
  const heartbeat = useMutation(api.users.heartbeat);
  const goOffline = useMutation(api.users.goOffline);
  const registerDevice = useMutation(api.users.registerDevice);
  const statusRef = useRef<PresenceStatus>("online");

  useEffect(() => {
    if (!isAuthenticated) return;

    // Sync this instance's ref from the shared value on mount, so a status
    // picked in one component survives the other component mounting later.
    statusRef.current = sharedStatus;

    const name =
      navigator.platform + " · " + (navigator.userAgent.includes("Mobile") ? "Mobile" : "Desktop");

    registerDevice({ name, platform: navigator.platform, isCurrent: true }).catch(() => {});

    const send = () => heartbeat({ status: sharedStatus }).catch(() => {});
    send();
    const id = setInterval(send, HEARTBEAT_MS);

    const onVisibility = () => {
      if (document.hidden) {
        goOffline().catch(() => {});
      } else {
        // Re-sync the shared status (a picker instance may have changed it).
        heartbeat({ status: sharedStatus }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onUnload = () => {
      goOffline().catch(() => {});
    };
    window.addEventListener("beforeunload", onUnload);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onUnload);
      // Only go offline on unmount when nothing else still uses presence
      // (both AppShell and PresenceSelector unmount together anyway).
      goOffline().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?._id]);

  const setStatus = (s: PresenceStatus) => {
    sharedStatus = s;
    statusRef.current = s;
    heartbeat({ status: s }).catch(() => {});
  };

  return { setStatus };
}
