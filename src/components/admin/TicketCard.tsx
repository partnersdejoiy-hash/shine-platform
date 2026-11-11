import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { displayName, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Check,
  Mail,
  MessageSquarePlus,
  Sparkles,
  Ticket,
  Trash2,
  X,
} from "lucide-react";
import { Fragment, useState } from "react";

/**
 * Enterprise access-ticket card — used in the Admin console (ticket tab).
 *
 * Supports: status badges (pending / in_progress / approved / rejected /
 * resolved / cancelled), the approval chain with per-approver state, threaded
 * teammate notes, pick-up, approve/reject with comments, and (for password
 * recovery tickets) a one-click "send temporary password" action. Super admin
 * also gets a hard delete for test/duplicate tickets.
 */
export function TicketCard({
  t,
  myId,
  compact,
  canDecide,
  isSuper,
  onDecide,
  onAddNote,
  onPickup,
  onSendTemp,
  onDelete,
}: {
  t: any;
  myId?: string;
  compact?: boolean;
  canDecide: boolean;
  isSuper?: boolean;
  onDecide: (approve: boolean, comment: string) => Promise<void>;
  onAddNote?: (text: string) => Promise<void>;
  onPickup?: () => Promise<void>;
  onSendTemp?: () => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<null | boolean>(null);
  const [note, setNote] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const chain: any[] = t.chain ?? [];
  const level = t.currentLevel ?? 0;
  const isOpen = t.status === "pending" || t.status === "in_progress";
  const isPassword = t.kind === "password";
  const statusCls =
    t.status === "pending"
      ? "bg-amber-500/15 text-amber-400"
      : t.status === "in_progress"
        ? "bg-sky-500/15 text-sky-400"
        : t.status === "approved"
          ? "bg-emerald-500/15 text-emerald-400"
          : t.status === "resolved"
            ? "bg-emerald-500/15 text-emerald-400"
            : t.status === "rejected"
              ? "bg-rose-500/15 text-rose-400"
              : "bg-accent text-muted-foreground";

  return (
    <div className={cn("flex flex-col gap-3 p-3.5", compact && "py-3")}>
      <div className="flex flex-wrap items-start gap-3">
        <UserAvatar user={t.requester} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-primary">
              {t.ticketNumber}
            </span>
            <span className="truncate text-sm font-medium">{t.title}</span>
            <Badge className={statusCls}>{t.status}</Badge>
            {t.pickedUpBy && (
              <Badge className="bg-sky-500/10 text-[10px] text-sky-400">
                picked up by {t.pickedUpBy?.name ?? "staff"}
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>
              {t.requester ? displayName(t.requester as any) : "Unknown"}
              {t.requester?.employeeId ? ` (${t.requester.employeeId})` : ""}
            </span>
            <span>·</span>
            <Badge className="bg-accent font-mono text-[10px] text-muted-foreground">{t.kind}</Badge>
            <Badge className="bg-accent font-mono text-[10px] text-muted-foreground">{t.target}</Badge>
            <span>·</span>
            <span>{timeAgo(t.createdAt)}</span>
          </div>
          {t.description && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{t.description}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {isPassword && isOpen && onSendTemp && (
            <Button
              size="sm"
              className="h-8 gap-1 text-xs"
              disabled={actionBusy}
              onClick={async () => {
                setActionBusy(true);
                await onSendTemp();
                setActionBusy(false);
              }}
            >
              <Mail className="size-3.5" /> Send temp password
            </Button>
          )}
          {isOpen && t.status === "pending" && !isPassword && onPickup && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs text-muted-foreground"
              disabled={actionBusy}
              onClick={async () => {
                setActionBusy(true);
                await onPickup();
                setActionBusy(false);
              }}
            >
              <Check className="size-3.5" /> Pick up
            </Button>
          )}
          {canDecide && onDecide && (
            <>
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Comment (optional)"
                className="h-8 w-48 rounded-md border border-input bg-background px-2.5 text-xs outline-none transition-colors focus:border-primary/50"
              />
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy(true);
                    await onDecide(true, comment);
                    setBusy(null);
                  }}
                >
                  <Check className="size-3.5" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs text-muted-foreground"
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy(false);
                    await onDecide(false, comment);
                    setBusy(null);
                  }}
                >
                  <X className="size-3.5" /> Reject
                </Button>
              </div>
            </>
          )}
          {isSuper && onDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-[10px] text-muted-foreground hover:text-rose-400"
              disabled={actionBusy}
              onClick={async () => {
                setActionBusy(true);
                await onDelete();
                setActionBusy(false);
              }}
            >
              <Trash2 className="size-3" /> Delete
            </Button>
          )}
        </div>
      </div>

      {/* teammate notes */}
      {(t.notes ?? []).length > 0 && (
        <div className="ml-12 space-y-1 border-l border-border/60 pl-3">
          {(t.notes ?? []).map((n: any, i: number) => (
            <div key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground">
              <MessageSquarePlus className="mt-0.5 size-3 shrink-0 text-primary" />
              <span className="font-medium text-foreground/80">{n.author?.name ?? "Teammate"}</span>
              <span className="flex-1">{n.text}</span>
              <span className="shrink-0">{timeAgo(n.at)}</span>
            </div>
          ))}
        </div>
      )}
      {onAddNote && isOpen && (
        <div className="ml-12 flex items-center gap-1.5">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note for teammates…"
            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 text-xs outline-none transition-colors focus:border-primary/50"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            disabled={noteBusy || !note.trim()}
            onClick={async () => {
              setNoteBusy(true);
              await onAddNote(note.trim());
              setNote("");
              setNoteBusy(false);
            }}
          >
            <MessageSquarePlus className="size-3.5" /> Add note
          </Button>
        </div>
      )}

      {/* approver chain — who has acted and who is next */}
      {chain.length > 0 && (
        <div className="ml-12 flex flex-wrap items-center gap-1.5">
          {chain.map((approver: any, i: number) => {
            const acted = t.decisions?.find((d: any) => String(d.approverId) === String(approver?._id));
            const isCurrent = isOpen && i === level && String(approver?._id) === String(myId);
            const isWaiting = isOpen && i === level;
            return (
              <Fragment key={i}>
                {i > 0 && <span className="text-[10px] text-muted-foreground">→</span>}
                <span
                  title={`${approver?.name ?? "?"}${acted ? ` · ${acted.action} ${acted.comment ? "· " + acted.comment : ""}` : ""}`}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                    acted?.action === "approved" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
                    acted?.action === "rejected" && "border-rose-500/40 bg-rose-500/10 text-rose-400",
                    isCurrent && "border-primary/60 bg-primary/15 font-semibold text-primary",
                    isWaiting && "border-amber-500/40 bg-amber-500/10 text-amber-400",
                    !acted && !isWaiting && "border-border/70 bg-card text-muted-foreground",
                  )}
                >
                  {approver?.name ?? "?"}
                  {isCurrent && <Sparkles className="size-2.5" />}
                </span>
              </Fragment>
            );
          })}
          {isOpen && (
            <span className="text-[10px] italic text-muted-foreground">
              awaiting level {Math.min(level + 1, chain.length)} of {chain.length}
            </span>
          )}
        </div>
      )}

      {/* decision trail */}
      {(t.decisions ?? []).length > 0 && (
        <div className="ml-12 space-y-1 border-l border-border/60 pl-3">
          {(t.decisions ?? []).map((d: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  d.action === "approved" ? "bg-emerald-400" : d.action === "rejected" ? "bg-rose-400" : "bg-primary",
                )}
              />
              <span className="font-medium text-foreground/80">{d.approver?.name ?? "Approver"}</span>
              <span>{d.action}</span>
              {d.comment && <span className="italic">“{d.comment}”</span>}
              <span>· {timeAgo(d.at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
