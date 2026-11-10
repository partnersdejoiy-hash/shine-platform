// SHINE accent palette — per-user app color theming.
//
// Each accent defines the CSS variables that drive the entire UI (buttons,
// glows, rings, the golden logo tint, charts) in both dark and light themes.
// The user picks one from Settings → Appearance; it is stored on their user
// doc (accentColor) so it persists per-user until they change it themselves.

export interface AccentDef {
  id: string;
  label: string;
  /** Tailwind-ish swatch used in the picker preview */
  swatch: string;
  dark: {
    "--primary": string;
    "--primary-foreground": string;
    "--ring": string;
    "--gold": string;
    "--gold-soft": string;
    "--chart-1": string;
    "--sidebar-primary": string;
    "--sidebar-primary-foreground": string;
  };
  light: {
    "--primary": string;
    "--primary-foreground": string;
    "--ring": string;
    "--gold": string;
    "--gold-soft": string;
    "--chart-1": string;
    "--sidebar-primary": string;
    "--sidebar-primary-foreground": string;
  };
}

export const ACCENTS: AccentDef[] = [
  {
    id: "dejoiy",
    label: "Dejoiy Pink",
    swatch: "#ff4fa3",
    dark: {
      "--primary": "#ff5cab",
      "--primary-foreground": "#121212",
      "--ring": "#ff5cab",
      "--gold": "#ff5cab",
      "--gold-soft": "rgb(255 92 171 / 16%)",
      "--chart-1": "#ff5cab",
      "--sidebar-primary": "#ff5cab",
      "--sidebar-primary-foreground": "#121212",
    },
    light: {
      "--primary": "#ff4fa3",
      "--primary-foreground": "#121212",
      "--ring": "#ff4fa3",
      "--gold": "#ff4fa3",
      "--gold-soft": "rgb(255 79 163 / 16%)",
      "--chart-1": "#ff4fa3",
      "--sidebar-primary": "#ff4fa3",
      "--sidebar-primary-foreground": "#121212",
    },
  },
  {
    id: "gold",
    label: "Royal Gold",
    swatch: "linear-gradient(140deg,#f2d469,#d4af37 55%,#8f6e1a)",
    dark: {
      "--primary": "oklch(0.8 0.13 87)",
      "--primary-foreground": "oklch(0.15 0.01 85)",
      "--ring": "oklch(0.8 0.13 87 / 45%)",
      "--gold": "oklch(0.8 0.13 87)",
      "--gold-soft": "oklch(0.8 0.13 87 / 13%)",
      "--chart-1": "oklch(0.8 0.13 87)",
      "--sidebar-primary": "oklch(0.8 0.13 87)",
      "--sidebar-primary-foreground": "oklch(0.15 0.01 85)",
    },
    light: {
      "--primary": "oklch(0.62 0.115 82)",
      "--primary-foreground": "oklch(1 0 0)",
      "--ring": "oklch(0.62 0.115 82 / 45%)",
      "--gold": "oklch(0.66 0.12 84)",
      "--gold-soft": "oklch(0.66 0.12 84 / 14%)",
      "--chart-1": "oklch(0.62 0.115 82)",
      "--sidebar-primary": "oklch(0.62 0.115 82)",
      "--sidebar-primary-foreground": "oklch(1 0 0)",
    },
  },
  {
    id: "emerald",
    label: "Emerald",
    swatch: "linear-gradient(140deg,#6ee7b7,#10b981 55%,#065f46)",
    dark: {
      "--primary": "oklch(0.78 0.14 165)",
      "--primary-foreground": "oklch(0.15 0.02 165)",
      "--ring": "oklch(0.78 0.14 165 / 45%)",
      "--gold": "oklch(0.78 0.14 165)",
      "--gold-soft": "oklch(0.78 0.14 165 / 13%)",
      "--chart-1": "oklch(0.78 0.14 165)",
      "--sidebar-primary": "oklch(0.78 0.14 165)",
      "--sidebar-primary-foreground": "oklch(0.15 0.02 165)",
    },
    light: {
      "--primary": "oklch(0.55 0.15 162)",
      "--primary-foreground": "oklch(1 0 0)",
      "--ring": "oklch(0.55 0.15 162 / 45%)",
      "--gold": "oklch(0.58 0.15 163)",
      "--gold-soft": "oklch(0.58 0.15 163 / 14%)",
      "--chart-1": "oklch(0.55 0.15 162)",
      "--sidebar-primary": "oklch(0.55 0.15 162)",
      "--sidebar-primary-foreground": "oklch(1 0 0)",
    },
  },
  {
    id: "sapphire",
    label: "Sapphire",
    swatch: "linear-gradient(140deg,#93c5fd,#3b82f6 55%,#1e3a8a)",
    dark: {
      "--primary": "oklch(0.72 0.13 250)",
      "--primary-foreground": "oklch(0.15 0.02 250)",
      "--ring": "oklch(0.72 0.13 250 / 45%)",
      "--gold": "oklch(0.72 0.13 250)",
      "--gold-soft": "oklch(0.72 0.13 250 / 13%)",
      "--chart-1": "oklch(0.72 0.13 250)",
      "--sidebar-primary": "oklch(0.72 0.13 250)",
      "--sidebar-primary-foreground": "oklch(0.15 0.02 250)",
    },
    light: {
      "--primary": "oklch(0.52 0.15 256)",
      "--primary-foreground": "oklch(1 0 0)",
      "--ring": "oklch(0.52 0.15 256 / 45%)",
      "--gold": "oklch(0.56 0.15 256)",
      "--gold-soft": "oklch(0.56 0.15 256 / 14%)",
      "--chart-1": "oklch(0.52 0.15 256)",
      "--sidebar-primary": "oklch(0.52 0.15 256)",
      "--sidebar-primary-foreground": "oklch(1 0 0)",
    },
  },
  {
    id: "violet",
    label: "Amethyst",
    swatch: "linear-gradient(140deg,#c4b5fd,#8b5cf6 55%,#5b21b6)",
    dark: {
      "--primary": "oklch(0.74 0.16 295)",
      "--primary-foreground": "oklch(0.16 0.02 295)",
      "--ring": "oklch(0.74 0.16 295 / 45%)",
      "--gold": "oklch(0.74 0.16 295)",
      "--gold-soft": "oklch(0.74 0.16 295 / 13%)",
      "--chart-1": "oklch(0.74 0.16 295)",
      "--sidebar-primary": "oklch(0.74 0.16 295)",
      "--sidebar-primary-foreground": "oklch(0.16 0.02 295)",
    },
    light: {
      "--primary": "oklch(0.52 0.18 295)",
      "--primary-foreground": "oklch(1 0 0)",
      "--ring": "oklch(0.52 0.18 295 / 45%)",
      "--gold": "oklch(0.56 0.17 295)",
      "--gold-soft": "oklch(0.56 0.17 295 / 14%)",
      "--chart-1": "oklch(0.52 0.18 295)",
      "--sidebar-primary": "oklch(0.52 0.18 295)",
      "--sidebar-primary-foreground": "oklch(1 0 0)",
    },
  },
  {
    id: "rose",
    label: "Rose Gold",
    swatch: "linear-gradient(140deg,#fda4af,#f43f5e 55%,#9f1239)",
    dark: {
      "--primary": "oklch(0.72 0.16 10)",
      "--primary-foreground": "oklch(0.16 0.02 10)",
      "--ring": "oklch(0.72 0.16 10 / 45%)",
      "--gold": "oklch(0.72 0.16 10)",
      "--gold-soft": "oklch(0.72 0.16 10 / 13%)",
      "--chart-1": "oklch(0.72 0.16 10)",
      "--sidebar-primary": "oklch(0.72 0.16 10)",
      "--sidebar-primary-foreground": "oklch(0.16 0.02 10)",
    },
    light: {
      "--primary": "oklch(0.55 0.18 8)",
      "--primary-foreground": "oklch(1 0 0)",
      "--ring": "oklch(0.55 0.18 8 / 45%)",
      "--gold": "oklch(0.6 0.16 10)",
      "--gold-soft": "oklch(0.6 0.16 10 / 14%)",
      "--chart-1": "oklch(0.55 0.18 8)",
      "--sidebar-primary": "oklch(0.55 0.18 8)",
      "--sidebar-primary-foreground": "oklch(1 0 0)",
    },
  },
  {
    id: "cyan",
    label: "Ocean",
    swatch: "linear-gradient(140deg,#67e8f9,#06b6d4 55%,#164e63)",
    dark: {
      "--primary": "oklch(0.79 0.11 210)",
      "--primary-foreground": "oklch(0.15 0.02 210)",
      "--ring": "oklch(0.79 0.11 210 / 45%)",
      "--gold": "oklch(0.79 0.11 210)",
      "--gold-soft": "oklch(0.79 0.11 210 / 13%)",
      "--chart-1": "oklch(0.79 0.11 210)",
      "--sidebar-primary": "oklch(0.79 0.11 210)",
      "--sidebar-primary-foreground": "oklch(0.15 0.02 210)",
    },
    light: {
      "--primary": "oklch(0.55 0.13 210)",
      "--primary-foreground": "oklch(1 0 0)",
      "--ring": "oklch(0.55 0.13 210 / 45%)",
      "--gold": "oklch(0.6 0.12 210)",
      "--gold-soft": "oklch(0.6 0.12 210 / 14%)",
      "--chart-1": "oklch(0.55 0.13 210)",
      "--sidebar-primary": "oklch(0.55 0.13 210)",
      "--sidebar-primary-foreground": "oklch(1 0 0)",
    },
  },
  {
    id: "ruby",
    label: "Ruby",
    swatch: "linear-gradient(140deg,#fca5a5,#dc2626 55%,#7f1d1d)",
    dark: {
      "--primary": "oklch(0.72 0.17 25)",
      "--primary-foreground": "oklch(0.16 0.02 25)",
      "--ring": "oklch(0.72 0.17 25 / 45%)",
      "--gold": "oklch(0.72 0.17 25)",
      "--gold-soft": "oklch(0.72 0.17 25 / 13%)",
      "--chart-1": "oklch(0.72 0.17 25)",
      "--sidebar-primary": "oklch(0.72 0.17 25)",
      "--sidebar-primary-foreground": "oklch(0.16 0.02 25)",
    },
    light: {
      "--primary": "oklch(0.55 0.2 25)",
      "--primary-foreground": "oklch(1 0 0)",
      "--ring": "oklch(0.55 0.2 25 / 45%)",
      "--gold": "oklch(0.6 0.18 25)",
      "--gold-soft": "oklch(0.6 0.18 25 / 14%)",
      "--chart-1": "oklch(0.55 0.2 25)",
      "--sidebar-primary": "oklch(0.55 0.2 25)",
      "--sidebar-primary-foreground": "oklch(1 0 0)",
    },
  },
  {
    id: "amber",
    label: "Amber Sun",
    swatch: "linear-gradient(140deg,#fcd34d,#f59e0b 55%,#92400e)",
    dark: {
      "--primary": "oklch(0.8 0.14 75)",
      "--primary-foreground": "oklch(0.15 0.02 75)",
      "--ring": "oklch(0.8 0.14 75 / 45%)",
      "--gold": "oklch(0.8 0.14 75)",
      "--gold-soft": "oklch(0.8 0.14 75 / 13%)",
      "--chart-1": "oklch(0.8 0.14 75)",
      "--sidebar-primary": "oklch(0.8 0.14 75)",
      "--sidebar-primary-foreground": "oklch(0.15 0.02 75)",
    },
    light: {
      "--primary": "oklch(0.65 0.14 75)",
      "--primary-foreground": "oklch(1 0 0)",
      "--ring": "oklch(0.65 0.14 75 / 45%)",
      "--gold": "oklch(0.68 0.13 75)",
      "--gold-soft": "oklch(0.68 0.13 75 / 14%)",
      "--chart-1": "oklch(0.65 0.14 75)",
      "--sidebar-primary": "oklch(0.65 0.14 75)",
      "--sidebar-primary-foreground": "oklch(1 0 0)",
    },
  },
  {
    id: "teal",
    label: "Teal",
    swatch: "linear-gradient(140deg,#5eead4,#14b8a6 55%,#134e4a)",
    dark: {
      "--primary": "oklch(0.8 0.12 185)",
      "--primary-foreground": "oklch(0.15 0.02 185)",
      "--ring": "oklch(0.8 0.12 185 / 45%)",
      "--gold": "oklch(0.8 0.12 185)",
      "--gold-soft": "oklch(0.8 0.12 185 / 13%)",
      "--chart-1": "oklch(0.8 0.12 185)",
      "--sidebar-primary": "oklch(0.8 0.12 185)",
      "--sidebar-primary-foreground": "oklch(0.15 0.02 185)",
    },
    light: {
      "--primary": "oklch(0.58 0.12 185)",
      "--primary-foreground": "oklch(1 0 0)",
      "--ring": "oklch(0.58 0.12 185 / 45%)",
      "--gold": "oklch(0.62 0.12 185)",
      "--gold-soft": "oklch(0.62 0.12 185 / 14%)",
      "--chart-1": "oklch(0.58 0.12 185)",
      "--sidebar-primary": "oklch(0.58 0.12 185)",
      "--sidebar-primary-foreground": "oklch(1 0 0)",
    },
  },
  {
    id: "fuchsia",
    label: "Magenta",
    swatch: "linear-gradient(140deg,#f0abfc,#d946ef 55%,#701a75)",
    dark: {
      "--primary": "oklch(0.75 0.16 330)",
      "--primary-foreground": "oklch(0.16 0.02 330)",
      "--ring": "oklch(0.75 0.16 330 / 45%)",
      "--gold": "oklch(0.75 0.16 330)",
      "--gold-soft": "oklch(0.75 0.16 330 / 13%)",
      "--chart-1": "oklch(0.75 0.16 330)",
      "--sidebar-primary": "oklch(0.75 0.16 330)",
      "--sidebar-primary-foreground": "oklch(0.16 0.02 330)",
    },
    light: {
      "--primary": "oklch(0.55 0.19 330)",
      "--primary-foreground": "oklch(1 0 0)",
      "--ring": "oklch(0.55 0.19 330 / 45%)",
      "--gold": "oklch(0.6 0.17 330)",
      "--gold-soft": "oklch(0.6 0.17 330 / 14%)",
      "--chart-1": "oklch(0.55 0.19 330)",
      "--sidebar-primary": "oklch(0.55 0.19 330)",
      "--sidebar-primary-foreground": "oklch(1 0 0)",
    },
  },
];

export const DEFAULT_ACCENT_ID = "dejoiy";

export function getAccent(id?: string | null): AccentDef {
  if (!id) return ACCENTS.find((a) => a.id === DEFAULT_ACCENT_ID)!;
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0]; // unknown ids fall back to Dejoiy Pink
}

const VAR_KEYS = [
  "--primary",
  "--primary-foreground",
  "--ring",
  "--gold",
  "--gold-soft",
  "--chart-1",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
] as const;

/** Apply an accent to the document root for the current theme. */
export function applyAccent(id?: string | null) {
  if (typeof document === "undefined") return;
  const accent = getAccent(id);
  const isDark = document.documentElement.classList.contains("dark");
  const vars = isDark ? accent.dark : accent.light;
  const root = document.documentElement;
  for (const key of VAR_KEYS) {
    root.style.setProperty(key, vars[key]);
  }
  try {
    localStorage.setItem("shine-accent", accent.id);
  } catch {
    /* ignore */
  }
}

/** Re-apply the stored accent (used on boot + theme switch). */
export function applyStoredAccent() {
  let id: string | null = null;
  try {
    id = localStorage.getItem("shine-accent");
  } catch {
    /* ignore */
  }
  applyAccent(id);
}
