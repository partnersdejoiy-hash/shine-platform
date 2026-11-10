import { cn } from "@/lib/utils";

interface Props {
  size?: number;
  className?: string;
  showWordmark?: boolean;
  wordClassName?: string;
}

// Shine's mark: a pink tile, a white D that is also a chat bubble, a lime and a white dot.
export const SHINE_D = "M34.8 24.8H59.2A23.8 23.8 0 0 1 59.2 72.4H46.3L35.8 81.9V72.4H34.8Z M47.2 38.9H58.1A9.5 9.5 0 0 1 58.1 57.9H47.2Z";
export const SHINE_PINK = "#FF4FA3";
export const SHINE_LIME = "#D4F53C";

export function ShineMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" className={cn("shine-mark shrink-0", className)}>
      <rect width="100" height="100" rx="25" fill={SHINE_PINK} />
      <path d={SHINE_D} fill="#fff" fillRule="evenodd" />
      <circle className="shine-dot-lime" cx="22.8" cy="37.9" r="6.7" fill={SHINE_LIME} />
      <circle className="shine-dot-white" cx="22.8" cy="59" r="6.7" fill="#fff" />
    </svg>
  );
}

export function ShineLogo({ size = 36, className, showWordmark = true, wordClassName }: Props) {
  return (
    <div className={cn("shine-logo flex items-center gap-2.5", className)} aria-label="Shine by Dejoiy">
      <ShineMark size={size} />
      {showWordmark && (
        <span
          className={cn("font-extrabold leading-none tracking-[-0.045em] text-foreground", wordClassName)}
          style={{ fontSize: Math.round(size * 0.74) }}
        >
          Shine
        </span>
      )}
    </div>
  );
}
