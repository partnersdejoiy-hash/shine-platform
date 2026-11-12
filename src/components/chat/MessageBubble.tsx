import { api } from "@/convex/_generated/api";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { displayName, formatBytes, formatTime } from "@/lib/format";
import { QUICK_REACTIONS } from "@/lib/emoji";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import {
  Bookmark,
  Check,
  CheckCheck,
  Copy,
  CornerUpLeft,
  FileText,
  Forward,
  Link2,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Send,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export interface ChatMessage {
  _id: string;
  _creationTime: number;
  conversationId: string;
  senderId: string;
  body: string;
  kind: "text" | "file" | "voice" | "poll" | "system";
  parentId?: string;
  replyTo?: { body: string; senderName: string } | null;
  edited?: boolean;
  deleted?: boolean;
  forwarded?: boolean;
  pinned?: boolean;
  mentions?: string[];
  attachments?: {
    storageId?: string;
    url?: string;
    name: string;
    mimeType: string;
    size: number;
    kind?: string;
  }[];
  poll?: {
    question: string;
    options: { id: string; text: string; votes: string[] }[];
  };
  createdAt: number;
  sender: { _id: string; name?: string | null; image?: string | null; email?: string | null } | null;
  reactions: { _id: string; messageId: string; userId: string; emoji: string; createdAt: number }[];
  replyCount: number;
  readBy: string[];
  pinnedBy: string | null;
}

interface Props {
  message: ChatMessage;
  isOwn: boolean;
  showHeader: boolean;
  conversationKind: "chat" | "channel";
  onReply: (msg: ChatMessage) => void;
  onThreadOpen: (msg: ChatMessage) => void;
  onEdit: (msg: ChatMessage) => void;
  onPreview: (url: string, name: string) => void;
}

function renderBody(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const segments = text.split(/```/);
  segments.forEach((seg, i) => {
    if (i % 2 === 1) {
      const nl = seg.indexOf("\n");
      const code = (nl === -1 ? seg : seg.slice(nl + 1)).trimEnd();
      out.push(<CodeBlock key={`c${i}`} code={code} />);
    } else if (seg) {
      out.push(...renderProse(seg, `p${i}`));
    }
  });
  return out;
}

function renderProse(block: string, keyPrefix: string): React.ReactNode[] {
  const lines = block.split("\n");
  const out: React.ReactNode[] = [];
  lines.forEach((line, i) => {
    const key = `${keyPrefix}-${i}`;
    if (!line.trim()) return;
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      out.push(
        <div
          key={key}
          className={cn(
            "mb-1 font-semibold",
            heading[1].length === 1 ? "text-base" : heading[1].length === 2 ? "text-sm" : "text-[13px]",
          )}
        >
          {renderInline(heading[2])}
        </div>,
      );
      return;
    }
    if (line.startsWith("> ")) {
      out.push(
        <div key={key} className="mb-1 border-l-2 border-primary/40 pl-2 text-muted-foreground italic">
          {renderInline(line.slice(2))}
        </div>,
      );
      return;
    }
    const listItem = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/);
    if (listItem) {
      out.push(
        <div key={key} className="mb-0.5 flex gap-2">
          <span className="text-primary">•</span>
          <span>{renderInline(listItem[1])}</span>
        </div>,
      );
      return;
    }
    out.push(<div key={key} className="min-h-[1.4em]">{renderInline(line)}</div>);
  });
  return out;
}

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|https?:\/\/[^\s]+|@[\w][\w .-]*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@") && part.length > 1) {
      return (
        <span
          key={i}
          className="mx-0.5 inline-block rounded-md bg-primary/15 px-1.5 py-px font-medium text-primary"
        >
          {part}
        </span>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-card px-1.5 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={i} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copyCode = async () => {
    await navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="my-1.5 overflow-hidden rounded-xl border border-border/70 bg-[#0d1117]">
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          code
        </span>
        <button
          onClick={copyCode}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        >
          {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[12px] leading-5">
        <code className="font-mono text-foreground/90">{code}</code>
      </pre>
    </div>
  );
}

const SWIPE_REPLY = 56; // px dragged right before letting go starts a reply
const touchScreen = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

export function MessageBubble({
  message,
  isOwn,
  showHeader,
  conversationKind,
  onReply,
  onThreadOpen,
  onEdit,
  onPreview,
}: Props) {
  const { user } = useAuth();
  const react = useMutation(api.messages.react);
  const pin = useMutation(api.messages.pin);
  const toggleBookmark = useMutation(api.messages.toggleBookmark);
  const votePoll = useMutation(api.messages.votePoll);
  const [menuOpen, setMenuOpen] = useState(false);
  // swipe right to reply, like WhatsApp (touch screens only, so desktop text selection still works)
  const swipeX = useMotionValue(0);
  const replyHint = useTransform(swipeX, [0, SWIPE_REPLY], [0, 1]);
  const replyHintScale = useTransform(swipeX, [0, SWIPE_REPLY], [0.5, 1]);

  if (message.kind === "system") {
    return (
      <div className="my-3 flex justify-center">
        <span className="rounded-full bg-accent px-3 py-1 text-[11px] text-muted-foreground">
          {message.body}
        </span>
      </div>
    );
  }

  const myReaction = (emoji: string) =>
    message.reactions.some((r) => r.userId === user?._id && r.emoji === emoji);
  const reactions = message.reactions.reduce<{ emoji: string; count: number; mine: boolean }[]>(
    (acc, r) => {
      const existing = acc.find((a) => a.emoji === r.emoji);
      if (existing) {
        existing.count++;
        if (r.userId === user?._id) existing.mine = true;
      } else {
        acc.push({ emoji: r.emoji, count: 1, mine: r.userId === user?._id });
      }
      return acc;
    },
    [],
  );

  const othersRead = message.readBy.filter((id) => id !== message.senderId);
  const allRead = othersRead.length > 0;

  const imageAtt = message.attachments?.filter((a) => a.kind === "image") ?? [];
  const otherAtts = message.attachments?.filter((a) => a.kind !== "image") ?? [];

  const copy = async () => {
    await navigator.clipboard.writeText(message.body || "");
    toast("Copied to clipboard");
  };

  const copyLink = () => {
    const url = `${window.location.origin}/app/chats/${message.conversationId}`;
    navigator.clipboard.writeText(url).catch(() => {});
    toast("Link copied");
  };

  const menu = (
    <div
      className={cn(
        "absolute top-0 z-20 flex items-center gap-0.5 rounded-xl border border-border bg-popover p-1 shadow-xl",
        isOwn ? "left-2" : "right-2",
        menuOpen ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <QuickReactionRow onPick={(e) => react({ messageId: message._id as any, emoji: e }).catch(() => {})} />
      <MenuDivider />
      <ActionBtn title="Reply" onClick={() => onReply(message)}>
        <CornerUpLeft className="size-3.5" />
      </ActionBtn>
      {message.replyCount > 0 && (
        <ActionBtn title="Thread" onClick={() => onThreadOpen(message)}>
          <Send className="size-3.5" />
        </ActionBtn>
      )}
      <ActionBtn title="Pin" onClick={() => pin({ messageId: message._id as any }).catch(() => {})}>
        {message.pinnedBy ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
      </ActionBtn>
      <ActionBtn title="Forward" onClick={() => onForward()}>
        <Forward className="size-3.5" />
      </ActionBtn>
      <ActionBtn title="Bookmark" onClick={() => toggleBookmark({ messageId: message._id as any }).catch(() => {})}>
        <Bookmark className="size-3.5" />
      </ActionBtn>
      <ActionBtn title="Copy" onClick={copy}>
        <Copy className="size-3.5" />
      </ActionBtn>
      <ActionBtn title="Copy link" onClick={copyLink}>
        <Link2 className="size-3.5" />
      </ActionBtn>
      {isOwn && (
        <ActionBtn title="Edit" onClick={() => onEdit(message)}>
          <Pencil className="size-3.5" />
        </ActionBtn>
      )}
      <ActionBtn title="Delete" onClick={() => onDelete()}>
        <Trash2 className="size-3.5 text-destructive" />
      </ActionBtn>
    </div>
  );

  const onForward = () => {
    toast("Pick a destination in the list…");
    window.dispatchEvent(new CustomEvent("shine-forward", { detail: message._id }));
    setMenuOpen(false);
  };

  const onDelete = () => {
    if (isOwn) {
      window.dispatchEvent(
        new CustomEvent("shine-delete", { detail: { id: message._id, own: true } }),
      );
    } else {
      window.dispatchEvent(
        new CustomEvent("shine-delete", { detail: { id: message._id, own: false } }),
      );
    }
    setMenuOpen(false);
  };

  if (message.deleted) {
    return (
      <div className={cn("group my-0.5 flex px-4", isOwn ? "justify-end" : "justify-start")}>
        <div className="rounded-2xl border border-border/60 bg-accent px-4 py-2 text-xs italic text-muted-foreground">
          🗑️ This message was deleted
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("group relative my-0.5 flex px-4", isOwn ? "justify-end" : "justify-start")}
      onMouseEnter={() => setMenuOpen(true)}
      onMouseLeave={() => setMenuOpen(false)}
    >
      {menu}
      {touchScreen && (
        <motion.span
          aria-hidden
          style={{ opacity: replyHint, scale: replyHintScale }}
          className="pointer-events-none absolute left-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-accent text-foreground"
        >
          <CornerUpLeft className="size-4" />
        </motion.span>
      )}
      <motion.div
        className={cn("flex max-w-[78%] flex-col sm:max-w-[62%]", isOwn && "items-end")}
        style={{ x: swipeX }}
        drag={touchScreen ? "x" : false}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.6 }}
        dragSnapToOrigin
        onDragEnd={() => {
          if (swipeX.get() >= SWIPE_REPLY) {
            navigator.vibrate?.(12);
            onReply(message);
          }
        }}
      >
        {/* header for group/channel */}
        {showHeader && !isOwn && (
          <div className="mb-0.5 flex items-center gap-2 pl-1">
            <UserAvatar user={message.sender} size="xs" />
            <span className="text-xs font-semibold">{displayName(message.sender)}</span>
            {message.pinnedBy && <Pin className="size-3 text-primary" />}
          </div>
        )}

        {/* quoted reply preview */}
        {message.parentId && (
          <div
            className={cn(
              "mb-1 rounded-lg border-l-2 border-primary/60 bg-card px-2.5 py-1 text-[11px] text-muted-foreground",
              isOwn ? "mr-2" : "ml-2",
            )}
          >
            {message.replyTo?.senderName && <div className="font-semibold text-foreground/80">{message.replyTo.senderName}</div>}
            <div className="line-clamp-2">{message.replyTo?.body ?? "↪ reply"}</div>
          </div>
        )}

        <div
          className={cn(
            "relative rounded-[20px] px-3.5 py-2.5 text-[15px] leading-6 sm:text-[14px]",
            isOwn
              ? "bubble-out rounded-br-md text-foreground"
              : "bubble-in rounded-bl-md",
          )}
        >
          {message.forwarded && (
            <div className="mb-1 flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
              <Forward className="size-3" /> Forwarded
            </div>
          )}

          {/* images */}
          {imageAtt.length > 0 && (
            <div className={cn("mb-2 grid gap-1", imageAtt.length > 1 && "grid-cols-2")}>
              {imageAtt.map((a, i) => (
                <button
                  key={i}
                  onClick={() => a.url && onPreview(a.url, a.name)}
                  className="overflow-hidden rounded-lg border border-border/60 transition-transform hover:scale-[1.02]"
                >
                  <img src={a.url} alt={a.name} className="max-h-56 w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}

          {/* voice */}
          {message.kind === "voice" && (
            <div className="flex items-center gap-2 py-1">
              <audio controls src={message.attachments?.[0]?.url} className="h-9 w-52" preload="metadata" />
            </div>
          )}

          {/* other attachments */}
          {otherAtts.length > 0 && (
            <div className="mb-2 space-y-1.5">
              {otherAtts.map((a, i) => (
                <a
                  key={i}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-card p-2 transition-colors hover:border-primary/40"
                >
                  <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
                    <FileText className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{a.name}</div>
                    <div className="text-[10px] text-muted-foreground">{formatBytes(a.size)}</div>
                  </div>
                </a>
              ))}
            </div>
          )}

          {/* poll */}
          {message.kind === "poll" && message.poll && (
            <PollBody
              message={message}
              votePoll={
                votePoll as unknown as (args: { messageId: string; optionId: string }) => Promise<unknown>
              }
              myId={user?._id ?? ""}
            />
          )}

          {message.body && <div className="break-words">{renderBody(message.body)}</div>}

          <div
            className={cn(
              "mt-1 flex items-center justify-end gap-1.5 text-[10px]",
              isOwn ? "text-foreground/60" : "text-muted-foreground",
            )}
          >
            {message.edited && <span className="italic">edited</span>}
            <span>{formatTime(message.createdAt)}</span>
            {isOwn && (
              <span className={cn("flex items-center", allRead ? "text-primary" : "text-foreground/45")}>
                <CheckCheck className="size-3.5" />
              </span>
            )}
          </div>
        </div>

        {/* reactions */}
        {reactions.length > 0 && (
          <div className={cn("mt-1 flex gap-1", isOwn && "flex-row-reverse")}>
            {reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => react({ messageId: message._id as any, emoji: r.emoji }).catch(() => {})}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all hover:scale-105",
                  r.mine
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                {r.emoji} <span className="text-[10px]">{r.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* thread */}
        {message.replyCount > 0 && (
          <button
            onClick={() => onThreadOpen(message)}
            className={cn(
              "mt-1 flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              isOwn && "flex-row-reverse",
            )}
          >
            <Send className="size-3" /> {message.replyCount} repl{message.replyCount === 1 ? "y" : "ies"}
          </button>
        )}

        {isOwn && othersRead.length > 0 && (
          <div className="mt-0.5 text-[9px] text-muted-foreground/70">
            Seen by {othersRead.length}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function PollBody({
  message,
  votePoll,
  myId,
}: {
  message: ChatMessage;
  votePoll: (args: { messageId: string; optionId: string }) => Promise<unknown>;
  myId: string;
}) {
  const poll = message.poll!;
  const total = poll.options.reduce((s, o) => s + o.votes.length, 0);
  const myVote = poll.options.find((o) => o.votes.includes(myId))?.id;

  return (
    <div className="mb-1.5 min-w-56 rounded-xl border border-border/70 bg-card p-2.5">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
        📊 {poll.question}
      </div>
      <div className="space-y-1.5">
        {poll.options.map((o) => {
          const pct = total ? Math.round((o.votes.length / total) * 100) : 0;
          const voted = myVote === o.id;
          return (
            <button
              key={o.id}
              disabled={!!myVote}
              onClick={() => votePoll({ messageId: message._id as any, optionId: o.id }).catch(() => {})}
              className={cn(
                "relative w-full overflow-hidden rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors",
                voted
                  ? "border-primary/50 bg-primary/10"
                  : myVote
                    ? "border-border/60 bg-card opacity-60"
                    : "border-border/70 bg-card hover:border-primary/40",
              )}
            >
              <div
                className={cn(
                  "absolute inset-y-0 left-0 bg-primary/12 transition-all duration-500",
                  voted && "bg-primary/20",
                )}
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between">
                <span className={cn("font-medium", voted && "text-primary")}>
                  {o.text} {voted && "✓"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {o.votes.length} · {pct}%
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-2 text-[10px] text-muted-foreground">
        {total} vote{total === 1 ? "" : "s"} · {myVote ? "You voted" : "Tap an option to vote"}
      </div>
    </div>
  );
}

function QuickReactionRow({ onPick }: { onPick: (e: string) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {QUICK_REACTIONS.slice(0, 6).map((e) => (
        <button
          key={e}
          onClick={() => onPick(e)}
          className="rounded-md p-1 text-sm transition-transform hover:scale-125"
        >
          {e}
        </button>
      ))}
    </div>
  );
}

function MenuDivider() {
  return <div className="mx-0.5 h-5 w-px bg-border" />;
}

function ActionBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}

export function conversationName(
  conversation: { name?: string; kind: string; chatType?: string },
  members: { _id: string; name?: string | null }[],
  myId?: string,
): string {
  if (conversation.kind === "channel") return `#${conversation.name}`;
  if (conversation.chatType === "group") return conversation.name || "Group chat";
  const other = members.find((m) => m._id !== myId);
  return displayName(other ?? null);
}
