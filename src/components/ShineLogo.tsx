import { cn } from "@/lib/utils";

interface Props {
  size?: number;
  className?: string;
  showWordmark?: boolean;
  wordClassName?: string;
}

/** The Dejoiy ":D" mark, the same one Dejoiy Mail wears; follows the accent colour (--gold). */
export function DejoiyMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 -25 150 150" width={size} height={size} aria-hidden="true" className={cn("shrink-0", className)}>
      <path d="M18 -20H80A70 70 0 0 1 80 120H18A18 18 0 0 1 0 102V-2A18 18 0 0 1 18 -20Z" fill="var(--gold)" />
      <g transform="translate(22 17) scale(.66)">
        <circle cx="13" cy="28" r="12" fill="#FFFFFF" />
        <circle cx="13" cy="72" r="12" fill="#121212" />
        <path fillRule="evenodd" d="M38 0H88A50 50 0 0 1 88 100H38Z M62 26H86A24 24 0 0 1 86 74H62Z" fill="#121212" />
      </g>
    </svg>
  );
}

/** ":D Shine" — Dejoiy's chat app, styled like ":D Mail". */
export function ShineLogo({ size = 36, className, showWordmark = true, wordClassName }: Props) {
  return (
    <div className={cn("flex items-center gap-2", className)} aria-label="Shine by Dejoiy">
      <DejoiyMark size={size} />
      {showWordmark && (
        <span
          className={cn("font-extrabold leading-none tracking-[-0.045em] text-foreground", wordClassName)}
          style={{ fontSize: Math.round(size * 0.78) }}
        >
          Shine
        </span>
      )}
    </div>
  );
}
