export type PresenceStatus = "online" | "away" | "busy" | "invisible" | "offline";

export interface PresenceLike {
  status?: PresenceStatus;
  updatedAt?: number;
  customStatus?: string | null;
}

const ONLINE_WINDOW = 60_000;

export function effectiveStatus(p: PresenceLike | null | undefined): PresenceStatus {
  if (!p) return "offline";
  if (p.status === "invisible" || p.status === "offline") return p.status;
  const updated = p.updatedAt ?? 0;
  if (Date.now() - updated > ONLINE_WINDOW * 2) return "offline";
  return p.status ?? "offline";
}

export function isOnline(p: PresenceLike | null | undefined): boolean {
  return effectiveStatus(p) !== "offline";
}

export const PRESENCE_META: Record<PresenceStatus, { label: string; dot: string; ring: string }> = {
  online: { label: "Online", dot: "bg-emerald-400", ring: "ring-emerald-400/30" },
  away: { label: "Away", dot: "bg-amber-400", ring: "ring-amber-400/30" },
  busy: { label: "Busy", dot: "bg-rose-500", ring: "ring-rose-500/30" },
  invisible: { label: "Invisible", dot: "bg-zinc-500", ring: "ring-zinc-500/30" },
  offline: { label: "Offline", dot: "bg-zinc-600", ring: "ring-zinc-600/30" },
};

export function presenceLabel(p: PresenceLike | null | undefined): string {
  return PRESENCE_META[effectiveStatus(p)].label;
}

export function presenceDotClass(p: PresenceLike | null | undefined): string {
  return PRESENCE_META[effectiveStatus(p)].dot;
}
