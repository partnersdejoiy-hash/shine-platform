export type PresenceStatus = "online" | "away" | "busy" | "invisible" | "offline";
/** what you pick: Automatic (Active, or Away when idle), Away, Do not disturb, Appear offline */
export type PresenceChoice = "auto" | "away" | "busy" | "invisible";

export interface PresenceLike {
  status?: PresenceStatus;
  updatedAt?: number;
  customStatus?: string | null;
}

const ONLINE_WINDOW = 60_000;

export function effectiveStatus(p: PresenceLike | null | undefined): PresenceStatus {
  if (!p) return "offline";
  if (p.status === "offline") return "offline";
  if (p.status === "invisible") return "invisible";
  const updated = p.updatedAt ?? 0;
  if (Date.now() - updated > ONLINE_WINDOW * 2) return "offline";
  return p.status ?? "offline";
}

export function isOnline(p: PresenceLike | null | undefined): boolean {
  return effectiveStatus(p) !== "offline";
}

export const PRESENCE_META: Record<PresenceStatus, { label: string; dot: string; ring: string }> = {
  online: { label: "Active", dot: "bg-emerald-400", ring: "ring-emerald-400/30" },
  away: { label: "Away", dot: "bg-amber-400", ring: "ring-amber-400/30" },
  busy: { label: "Do not disturb", dot: "bg-rose-500", ring: "ring-rose-500/30" },
  invisible: { label: "Offline", dot: "bg-zinc-500", ring: "ring-zinc-500/30" },
  offline: { label: "Offline", dot: "bg-zinc-600", ring: "ring-zinc-600/30" },
};

export function presenceLabel(p: PresenceLike | null | undefined): string {
  return PRESENCE_META[effectiveStatus(p)].label;
}

export function presenceDotClass(p: PresenceLike | null | undefined): string {
  return PRESENCE_META[effectiveStatus(p)].dot;
}

/** the choices in the status sheet, in Gmail's words */
export const PRESENCE_CHOICES: { value: PresenceChoice; label: string; hint: string; dot: string }[] = [
  { value: "auto", label: "Automatic", hint: "Active, or Away after 5 minutes idle", dot: "bg-emerald-400" },
  { value: "busy", label: "Do not disturb", hint: "Colleagues see you're busy", dot: "bg-rose-500" },
  { value: "away", label: "Set as away", hint: "Show Away even when you're here", dot: "bg-amber-400" },
  { value: "invisible", label: "Appear offline", hint: "Others see you as offline", dot: "bg-zinc-500" },
];

/** quick written statuses, like WhatsApp's "About" presets */
export const STATUS_PRESETS = [
  "Available",
  "📅 In a meeting",
  "📞 On a call",
  "🏡 Working from home",
  "🎯 Focusing",
  "🚗 Commuting",
  "🤒 Out sick",
  "🌴 On leave",
];
