import { cn } from "@/lib/utils";

interface Props {
  size?: number;
  className?: string;
  showWordmark?: boolean;
  wordClassName?: string;
}

/**
 * SHINE logo — golden hexagonal chat bubble with three dots.
 * The gradient + glow read from CSS vars (--gold / --primary) so the logo
 * tints to the user's chosen accent color (Settings → Appearance).
 */
export function ShineLogo({ size = 36, className, showWordmark = true, wordClassName }: Props) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        fill="none"
        aria-label="SHINE logo"
        className="shrink-0 drop-shadow-[0_6px_18px_var(--gold-soft)]"
        style={{ color: "var(--gold)" }}
      >
        <defs>
          <linearGradient id="shineGoldLogo" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#F7E08A" />
            <stop offset="0.45" stopColor="#D4AF37" />
            <stop offset="1" stopColor="#8F6E1A" />
          </linearGradient>
          <radialGradient id="shineDotLogo" cx="0.35" cy="0.3" r="1">
            <stop offset="0" stopColor="#FFF6D8" />
            <stop offset="0.55" stopColor="#E8C458" />
            <stop offset="1" stopColor="#9A7B1E" />
          </radialGradient>
        </defs>

        {/* hexagon ribbon */}
        <path
          d="M32 3.2 L52.6 14.2 Q56 16 56 19.9 L56 37 Q56 42.4 51.4 44.9 L39.2 51.9 Q37.6 52.7 37.6 54.5 L37.6 58.4 Q37.6 60.8 35.2 60.8 L32 60.8 L28.8 60.8 Q26.4 60.8 26.4 58.4 L26.4 54.5 Q26.4 52.7 24.8 51.9 L12.6 44.9 Q8 42.4 8 37 L8 19.9 Q8 16 11.4 14.2 Z"
          fill="url(#shineGoldLogo)"
        />
        <path
          d="M52.6 14.2 Q56 16 56 19.9 L56 20.6 L48.4 16.6 Q45.2 14.9 44.2 11.4 L42 3.6 Q41.4 1.9 43.2 1.9 L45.2 1.9 Q47.8 1.9 49.6 3.6 Z"
          fill="#F2D469"
          opacity="0.92"
        />
        {/* inner cavity */}
        <path
          d="M32 11 L47.6 19.3 Q49.6 20.4 49.6 22.7 L49.6 35.6 Q49.6 39.2 46.6 40.8 L37.6 46 Q35.4 47.2 35.4 49.4 L35.4 53.2 L32 53.2 L28.6 53.2 L28.6 49.4 Q28.6 47.2 26.4 46 L17.4 40.8 Q14.4 39.2 14.4 35.6 L14.4 22.7 Q14.4 20.4 16.4 19.3 Z"
          fill="#0B0B0B"
        />
        <path
          d="M32 13.4 L46 20.9 L46 35.3 Q46 38 43.6 39.3 L35.6 44 Q34 44.9 34 46.7 L34 50 L32 50 L30 50 L30 46.7 Q30 44.9 28.4 44 L20.4 39.3 Q18 38 18 35.3 L18 20.9 Z"
          fill="#141414"
          stroke="var(--gold)"
          strokeOpacity="0.4"
          strokeWidth="0.8"
        />
        {/* three dots — tinted by accent */}
        <circle cx="20.5" cy="28.5" r="3.4" fill="var(--gold)" />
        <circle cx="32" cy="28.5" r="3.4" fill="var(--gold)" />
        <circle cx="43.5" cy="28.5" r="3.4" fill="var(--gold)" />
        <circle cx="20.5" cy="28.5" r="6.2" fill="var(--gold)" opacity="0.22" />
        <circle cx="32" cy="28.5" r="6.2" fill="var(--gold)" opacity="0.22" />
        <circle cx="43.5" cy="28.5" r="6.2" fill="var(--gold)" opacity="0.22" />
      </svg>
      {showWordmark && (
        <div className="leading-none">
          <div className={cn("text-lg font-bold tracking-[0.18em] text-foreground", wordClassName)}>
            SHINE
          </div>
          <div className="mt-1 text-[9px] font-medium tracking-[0.28em] text-muted-foreground uppercase">
            Powered by Dejoiy
          </div>
        </div>
      )}
    </div>
  );
}
