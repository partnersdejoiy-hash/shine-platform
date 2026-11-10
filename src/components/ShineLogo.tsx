import { cn } from "@/lib/utils";

interface Props {
  size?: number;
  className?: string;
  showWordmark?: boolean;
  wordClassName?: string;
}

/**
 * SHINE logo — a chat-bubble sticker (ink outline, hard shadow, three dots),
 * same family as the Dejoiy Mail mark. The fill reads --gold, so it follows the
 * user's accent colour (Settings → Appearance).
 */
export function ShineLogo({ size = 36, className, showWordmark = true, wordClassName }: Props) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 64 64" width={size} height={size} fill="none" aria-label="SHINE logo" className="shrink-0 -rotate-6">
        {/* hard offset shadow */}
        <path d="M14 8h38a8 8 0 0 1 8 8v24a8 8 0 0 1-8 8H32l-12 10v-10h-6a8 8 0 0 1-8-8V16a8 8 0 0 1 8-8Z" transform="translate(3 3)" fill="#121212" />
        <path
          d="M14 8h38a8 8 0 0 1 8 8v24a8 8 0 0 1-8 8H32l-12 10v-10h-6a8 8 0 0 1-8-8V16a8 8 0 0 1 8-8Z"
          fill="var(--gold)"
          stroke="#121212"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        <circle cx="22" cy="28" r="3.8" fill="#121212" />
        <circle cx="33" cy="28" r="3.8" fill="#121212" />
        <circle cx="44" cy="28" r="3.8" fill="#121212" />
        <path d="M14.5 15.5h9" stroke="#fff" strokeOpacity=".75" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {showWordmark && (
        <div className="leading-none">
          <div className={cn("text-xl font-extrabold tracking-[-0.04em] text-foreground", wordClassName)}>Shine</div>
          <div className="mt-1 text-[10px] font-semibold text-muted-foreground">by Dejoiy</div>
        </div>
      )}
    </div>
  );
}
