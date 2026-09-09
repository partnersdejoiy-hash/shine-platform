/**
 * SHINE notification sounds.
 *
 * Every notification event maps to a playable sound. Users can set each event
 * to a builtin tone, off, or their own recorded/uploaded sound (see Settings →
 * Notifications → Sounds). All choices live in the user's `soundPrefs` map:
 *   soundPrefs[event] = "off" | "default" | "chime" | "ping" | "bell" | "classic" | "custom"
 */

export type SoundEvent = "message" | "mention" | "group" | "call" | "meeting" | "task" | "system";

export const SOUND_EVENTS: { key: SoundEvent; label: string; desc: string }[] = [
  { key: "message", label: "Direct message", desc: "New 1:1 chat message" },
  { key: "mention", label: "Mention", desc: "Someone @mentions you" },
  { key: "group", label: "Group message", desc: "New message in a group chat" },
  { key: "call", label: "Call", desc: "Incoming or missed call" },
  { key: "meeting", label: "Meeting", desc: "Meeting start & reminders" },
  { key: "task", label: "Task", desc: "Task assigned or updated" },
  { key: "system", label: "System", desc: "Policy & security alerts" },
];

export const SOUND_CHOICES = [
  { id: "default", label: "Default" },
  { id: "chime", label: "Chime" },
  { id: "ping", label: "Ping" },
  { id: "bell", label: "Bell" },
  { id: "classic", label: "Classic" },
  { id: "custom", label: "My sound" },
] as const;

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, gain: number) {
  const ac = audioCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, ac.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, ac.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + dur + 0.05);
}

/** Builtin tone patterns per choice id. */
const PATTERNS: Record<string, [number, number, number, number][]> = {
  default: [
    [880, 0, 0.12, 0.04],
    [1174, 0.09, 0.16, 0.04],
  ],
  chime: [
    [1046, 0, 0.2, 0.04],
    [1568, 0.16, 0.28, 0.04],
  ],
  ping: [
    [1318, 0, 0.25, 0.05],
    [1318, 0.28, 0.3, 0.05],
  ],
  bell: [
    [987, 0, 0.5, 0.05],
    [987, 0.02, 0.5, 0.03],
  ],
  classic: [
    [659, 0, 0.16, 0.05],
    [523, 0.18, 0.2, 0.05],
  ],
};

/** Event → builtin pattern (used for "default" / event-specific defaults). */
const EVENT_DEFAULTS: Record<SoundEvent, string> = {
  message: "default",
  mention: "chime",
  group: "ping",
  call: "classic",
  meeting: "bell",
  task: "default",
  system: "classic",
};

export function playMessageSound() {
  tone(880, 0, 0.12, 0.04);
  tone(1174, 0.09, 0.16, 0.04);
}

export function playCallRing() {
  for (let i = 0; i < 4; i++) {
    tone(660, i * 1.2, 0.5, 0.05);
    tone(830, i * 1.2 + 0.18, 0.4, 0.04);
  }
}

export function playCallConnect() {
  tone(523, 0, 0.12, 0.06);
  tone(659, 0.1, 0.12, 0.06);
  tone(784, 0.2, 0.2, 0.06);
}

export function playCallEnd() {
  tone(784, 0, 0.1, 0.05);
  tone(523, 0.1, 0.15, 0.05);
}

/**
 * Play the sound configured for a notification event.
 * soundPrefs[event] = "off" silences it; "custom" plays the user's own upload.
 */
export function playEventSound(
  event: SoundEvent,
  soundPrefs?: Record<string, string> | null,
  customUrl?: string | null,
) {
  const choice = (soundPrefs ?? {})[event] ?? "default";
  if (choice === "off") return;
  if (choice === "custom") {
    if (!customUrl) return;
    try {
      const a = new Audio(customUrl);
      a.volume = 0.85;
      a.play().catch(() => {});
    } catch {
      /* ignore */
    }
    return;
  }
  const pattern = PATTERNS[choice] ?? PATTERNS[EVENT_DEFAULTS[event] ?? "default"];
  for (const [freq, start, dur, gain] of pattern) tone(freq, start, dur, gain);
}

/** Map a notification kind to its sound event. */
export function eventForNotificationKind(kind?: string | null): SoundEvent {
  const k = (kind ?? "").toLowerCase();
  if (k.includes("mention")) return "mention";
  if (k.includes("group") || k.includes("channel") || k.includes("broadcast")) return "group";
  if (k.includes("call")) return "call";
  if (k.includes("meeting") || k.includes("invite")) return "meeting";
  if (k.includes("task")) return "task";
  if (k.includes("direct") || k.includes("message") || k.includes("dm")) return "message";
  return "system";
}

/** Preview a builtin choice immediately (used in Settings). */
export function previewSound(choice: string) {
  const pattern = PATTERNS[choice] ?? PATTERNS.default;
  for (const [freq, start, dur, gain] of pattern) tone(freq, start, dur, gain);
}
