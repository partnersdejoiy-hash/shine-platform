import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarGradient, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Camera } from "lucide-react";

interface Props {
  /** conversation object — uses image + name for the avatar */
  image?: string | null;
  name?: string | null;
  /** channel-style (no initials, uses a generic icon fallback) */
  isChannel?: boolean;
  size?: "sm" | "md" | "lg";
  /** show a camera overlay badge — enables click-to-change-photo */
  editable?: boolean;
  onPick?: () => void;
  className?: string;
  title?: string;
}

const SIZES = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
} as const;

export function GroupAvatar({
  image,
  name,
  isChannel,
  size = "md",
  editable = false,
  onPick,
  className,
  title,
}: Props) {
  const seed = name || (isChannel ? "channel" : "group");
  return (
    <div
      className={cn("relative shrink-0", className)}
      title={title}
    >
      <Avatar className={cn(SIZES[size], "ring-[1.5px] ring-[var(--sticker-border)]")}>
        {image ? (
          <AvatarImage src={image} alt={name ?? ""} />
        ) : (
          <AvatarFallback
            className="font-bold text-[#121212]"
            style={{ backgroundImage: avatarGradient(seed) }}
          >
            {initials(name ?? (isChannel ? "#" : "G"))}
          </AvatarFallback>
        )}
      </Avatar>
      {editable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPick?.();
          }}
          className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground shadow ring-2 ring-background transition-transform hover:scale-110"
          title="Change photo"
        >
          <Camera className="size-3" />
        </button>
      )}
    </div>
  );
}
