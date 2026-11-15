// A chat's own look, chosen by each person for themselves: the colour of its header and their bubbles,
// and the paper behind the messages. Ids only; the server keeps the id and checks it against these lists.
export const CHAT_TONES = [
  { id: "pink", label: "Shine pink", color: "#ff4fa3" },
  { id: "sun", label: "Sun", color: "#ffd23f" },
  { id: "mint", label: "Mint", color: "#3ddc84" },
  { id: "sky", label: "Sky", color: "#4da3ff" },
  { id: "lilac", label: "Lilac", color: "#b892ff" },
  { id: "peach", label: "Peach", color: "#ff8a3d" },
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
] as const;
export const CHAT_TONE_IDS: readonly string[] = CHAT_TONES.map((t) => t.id);
export const CHAT_PAPER_IDS: readonly string[] = CHAT_PAPERS.map((p) => p.id);
export type ChatLook = { tone?: string; paper?: string } | null | undefined;
export const toneColor = (look: ChatLook) => CHAT_TONES.find((t) => t.id === look?.tone)?.color;
export const paperClass = (look: ChatLook) => "chat-paper chat-paper-" + (CHAT_PAPER_IDS.includes(look?.paper ?? "") ? look!.paper : "dots");
