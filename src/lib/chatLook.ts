// A chat's own look, chosen by each person for themselves: the colour of its header and their bubbles,
// and the paper behind the messages. Ids only; the server keeps the id and checks it against these lists.
export const CHAT_TONES = [
  { id: "pink", label: "Shine pink", color: "#ff4fa3" },
  { id: "rose", label: "Rose", color: "#ff5c7a" },
  { id: "red", label: "Cherry", color: "#e5484d" },
  { id: "peach", label: "Peach", color: "#ff8a3d" },
  { id: "sun", label: "Sun", color: "#ffd23f" },
  { id: "lime", label: "Lime", color: "#a8d83a" },
  { id: "mint", label: "Mint", color: "#3ddc84" },
  { id: "green", label: "Leaf", color: "#2f9e5b" },
  { id: "teal", label: "Teal", color: "#1fb5a6" },
  { id: "sky", label: "Sky", color: "#4da3ff" },
  { id: "blue", label: "Ocean", color: "#2f6bff" },
  { id: "indigo", label: "Night", color: "#5b5bd6" },
  { id: "lilac", label: "Lilac", color: "#b892ff" },
  { id: "purple", label: "Grape", color: "#9b4de0" },
  { id: "blush", label: "Blush", color: "#ffb3d1" },
  { id: "sand", label: "Sand", color: "#c9a57b" },
  { id: "brown", label: "Cocoa", color: "#8d5a3b" },
  { id: "ink", label: "Ink", color: "#6b6470" },
] as const;
export const CHAT_PAPERS = [
  { id: "dots", label: "Dots" },
  { id: "plain", label: "Plain" },
  { id: "grid", label: "Grid" },
  { id: "lines", label: "Notebook" },
  { id: "checks", label: "Checks" },
  { id: "confetti", label: "Confetti" },
  { id: "waves", label: "Waves" },
  { id: "wash", label: "Colour wash" },
  { id: "hearts", label: "Hearts" },
  { id: "smiles", label: "Smiles" },
  { id: "stars", label: "Stars" },
  { id: "flowers", label: "Flowers" },
  { id: "clouds", label: "Clouds" },
  { id: "moons", label: "Moons" },
  { id: "leaves", label: "Leaves" },
  { id: "sparkles", label: "Sparkles" },
] as const;
/** Ready-made pairs: one tap sets the colour and the background together. */
export const CHAT_THEMES = [
  { id: "classic", label: "Classic", tone: "pink", paper: "dots" },
  { id: "love", label: "Love", tone: "rose", paper: "hearts" },
  { id: "joy", label: "Joy", tone: "sun", paper: "smiles" },
  { id: "party", label: "Party", tone: "purple", paper: "confetti" },
  { id: "calm", label: "Calm", tone: "sky", paper: "clouds" },
  { id: "night", label: "Night", tone: "indigo", paper: "moons" },
  { id: "garden", label: "Garden", tone: "blush", paper: "flowers" },
  { id: "forest", label: "Forest", tone: "green", paper: "leaves" },
  { id: "sunset", label: "Sunset", tone: "peach", paper: "wash" },
  { id: "ocean", label: "Ocean", tone: "blue", paper: "waves" },
  { id: "sparkle", label: "Sparkle", tone: "lilac", paper: "sparkles" },
  { id: "star", label: "Star", tone: "teal", paper: "stars" },
  { id: "candy", label: "Candy", tone: "pink", paper: "checks" },
  { id: "study", label: "Study", tone: "sand", paper: "lines" },
  { id: "ink", label: "Ink", tone: "ink", paper: "plain" },
] as const;
export const CHAT_TONE_IDS: readonly string[] = CHAT_TONES.map((t) => t.id);
export const CHAT_PAPER_IDS: readonly string[] = CHAT_PAPERS.map((p) => p.id);
export type ChatLook = { tone?: string; paper?: string } | null | undefined;
export const toneColor = (look: ChatLook) => CHAT_TONES.find((t) => t.id === look?.tone)?.color;
export const paperClass = (look: ChatLook) => "chat-paper chat-paper-" + (CHAT_PAPER_IDS.includes(look?.paper ?? "") ? look!.paper : "dots");
