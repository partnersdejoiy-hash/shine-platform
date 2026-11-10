// Every chat gets a colour, like every mail in Dejoiy Mail gets its label colour.
// Same palette as Dejoiy Mail's tones; the colour is stable per chat.
export const TONES = ["#ff4fa3", "#ffd23f", "#3ddc84", "#4da3ff", "#b892ff", "#ff8a3d"] as const;

export function toneFor(seed: string, kind?: string): string {
  if (kind === "channel") return "#4da3ff"; // channels and announcements read as "updates"
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}
