export function timeAgo(ts: number | undefined | null): string {
  if (!ts) return "never";
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatTime(ts: number | undefined | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function formatDate(ts: number | undefined | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatDayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDuration(sec: number): string {
  if (!sec || sec < 0) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function displayName(user: { name?: string | null; email?: string | null; isAnonymous?: boolean | null } | null | undefined): string {
  if (!user) return "Unknown";
  if (user.name) return user.name;
  if (user.email) return user.email.split("@")[0];
  return "Guest";
}

/** Deterministic gradient for an avatar fallback. */
export function avatarGradient(seed: string): string {
  // flat sticker colours, ink initials sit on all of them
  const palettes = ["#ff8fc4", "#ffd23f", "#7cc6ff", "#6ee7a8", "#c3a6ff", "#ffad6b"].map((c) => `linear-gradient(${c},${c})`);
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palettes[h % palettes.length];
}

/** URL-safe slug from a title (matches the server-side slugifyTitle). */
export function slugifyTitle(title: string): string {
  const slug = (title || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "meeting";
}

/**
 * Stable, pretty share link for a meeting:
 *   https://<host>/meet/<title-slug>/<room-code>
 * Works from the SHINE app and from meet.dejoiy.com alike.
 */
export function meetingUrl(
  base: string,
  meeting: { title: string; roomCode: string; slug?: string | null },
): string {
  const host = (base || "").replace(/\/$/, "");
  const slug = meeting.slug ?? slugifyTitle(meeting.title);
  return `${host}/meet/${encodeURIComponent(slug)}/${encodeURIComponent(meeting.roomCode)}`;
}

export function isSameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.toDateString() === db.toDateString();
}
