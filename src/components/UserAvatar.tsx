import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarGradient, initials } from "@/lib/format";
import { effectiveStatus, type PresenceLike } from "@/lib/presence";
import { cn } from "@/lib/utils";

interface Props {
  user?: { name?: string | null; image?: string | null; email?: string | null } | null;
  presence?: PresenceLike | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showStatus?: boolean;
  className?: string;
}

const SIZES = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
  xl: "size-16 text-xl",
};

const DOT = {
  xs: "size-1.5",
  sm: "size-2",
  md: "size-2.5",
  lg: "size-3",
  xl: "size-3.5",
};

const DOT_COLOR = {
  online: "bg-emerald-400",
  away: "bg-amber-400",
  busy: "bg-rose-500",
  invisible: "bg-zinc-500",
  offline: "bg-zinc-600",
} as const;

export function UserAvatar({ user, presence, size = "md", showStatus = false, className }: Props) {
  const seed = user?.name ?? user?.email ?? "user";
  const status = effectiveStatus(presence);
  return (
    <div className={cn("relative shrink-0", className)}>
      <Avatar className={cn(SIZES[size], "ring-1 ring-border")}>
        {user?.image ? (
          <AvatarImage src={user.image} alt={user?.name ?? ""} />
        ) : (
          <AvatarFallback
            className="font-semibold text-white"
            style={{ backgroundImage: avatarGradient(seed) }}
          >
            {initials(user?.name ?? user?.email)}
          </AvatarFallback>
        )}
      </Avatar>
      {showStatus && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full ring-2 ring-background",
            DOT[size],
            DOT_COLOR[status],
          )}
        />
      )}
    </div>
  );
}
