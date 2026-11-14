import type { CSSProperties } from "react";
import { GroupAvatar } from "@/components/chat/GroupAvatar";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { displayName, formatTime, timeAgo } from "@/lib/format";
import { effectiveStatus, isOnline, type PresenceLike } from "@/lib/presence";
import { cn } from "@/lib/utils";
import { toneFor } from "@/lib/tone";
import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { Hash, MessageSquarePlus, Mic, Pin, PinOff, Search, Volume2, VolumeX, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { useMutation } from "convex/react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors";

export interface ConversationItem {
  conversation: {
    _id: string;
    kind: "chat" | "channel";
    chatType?: string;
    channelKind?: string;
    name: string;
    image?: string | null;
    isMeeting?: boolean;
  };
  membership: { isMuted?: boolean; isPinned?: boolean; isArchived?: boolean };
  members: ({ _id: string; name?: string | null; image?: string | null } | null)[];
  lastMessage: {
    _id: string;
    body: string;
    kind: string;
    senderId: string;
    createdAt?: number;
    sender?: { _id: string; name?: string | null } | null;
  } | null;
  unread: number;
}

interface Props {
  items: ConversationItem[] | undefined;
  selectedId?: string | null;
  myId?: string;
  presenceMap: Record<string, PresenceLike | null | undefined>;
  typingMap: Record<string, { _id: string; name?: string | null }[]>;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  loading?: boolean;
  /** your colleagues, for the "Active now" row */
  people?: { _id: string; name?: string | null; email?: string | null; image?: string | null }[];
  onStartDirect?: (userId: string) => void;
}

const FILTERS = [
  ["all", "All"],
  ["unread", "Unread"],
  ["direct", "People"],
  ["group", "Groups"],
  ["channel", "Channels"],
] as const;

export function ConversationList({
  items,
  selectedId,
  myId,
  presenceMap,
  typingMap,
  onSelect,
  onNewChat,
  loading,
  people,
  onStartDirect,
}: Props) {
  const [q, setQ] = useState("");
  const [show, setShow] = useState<(typeof FILTERS)[number][0]>("all");
  const [ctxMenu, setCtxMenu] = useState<{ id: string; x: number; y: number; pinned: boolean; muted: boolean } | null>(null);
  const setMuted = useMutation(api.conversations.setMuted);
  const togglePin = useMutation(api.conversations.togglePin);
  const archiveConv = useMutation(api.conversations.archiveConversation);
  const deleteChat = useMutation(api.conversations.deleteChat);

  const filtered = useMemo(() => {
    if (!items) return [];
    const query = q.toLowerCase().trim();
    const kind = (i: ConversationItem) =>
      i.conversation.kind === "channel" ? "channel" : i.conversation.chatType === "group" ? "group" : "direct";
    const byChip = items.filter((i) => (show === "all" ? true : show === "unread" ? i.unread > 0 : kind(i) === show));
    if (!query) return byChip;
    return byChip.filter((item) => {
      const name = conversationTitle(item, myId).toLowerCase();
      const preview = item.lastMessage?.body.toLowerCase() ?? "";
      return name.includes(query) || preview.includes(query);
    });
  }, [items, q, myId, show]);

  // "Active now": colleagues online first, like the top row of a messaging app
  const active = useMemo(
    () =>
      (people ?? [])
        .filter((p) => p._id !== myId)
        .map((p) => ({ p, on: isOnline(presenceMap[p._id]) }))
        .sort((a, b) => Number(b.on) - Number(a.on) || (a.p.name ?? "").localeCompare(b.p.name ?? ""))
        .slice(0, 16),
    [people, presenceMap, myId],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-3 px-4 pb-2 pt-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search chats"
            aria-label="Search chats"
            className="h-10 rounded-full border-0 bg-muted pl-10 shadow-none focus-visible:ring-2"
          />
        </div>

        {active.length > 0 && (
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar" aria-label="Your team">
            {active.map(({ p, on }) => (
              <button
                key={p._id}
                onClick={() => onStartDirect?.(p._id)}
                style={{ "--t": toneFor(p._id) } as CSSProperties}
                className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-center transition-transform active:scale-95"
                title={[displayName(p), presenceMap[p._id]?.customStatus].filter(Boolean).join(" · ")}
              >
                {/* a ring, like WhatsApp's status ring, when they've written a status */}
                <span className={cn("rounded-full p-[2.5px]", presenceMap[p._id]?.customStatus ? "bg-primary" : on ? "bg-[var(--t)]" : "bg-transparent")}>
                  <span className="block rounded-full bg-background p-[2px]">
                    <UserAvatar user={p} presence={presenceMap[p._id]} size="lg" showStatus />
                  </span>
                </span>
                <span className="w-full truncate text-[11px] font-semibold">{displayName(p).split(" ")[0]}</span>
              </button>
            ))}
          </div>
        )}

        {/* like Dejoiy Mail's "All messages · Unread · …" */}
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 no-scrollbar" role="tablist" aria-label="Show">
          {FILTERS.map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={show === value}
              onClick={() => setShow(value)}
              className={cn(
                "h-8 shrink-0 rounded-full px-3.5 text-[13px] font-semibold transition-colors",
                show === value ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
              {value === "unread" && (items ?? []).some((i) => i.unread > 0) && (
                <span className="ml-1.5 inline-block size-2 rounded-full bg-primary align-middle" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-24 lg:pb-2">
        {loading && (
          <div className="space-y-2 p-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl p-2.5">
                <div className="size-10 animate-pulse rounded-full bg-accent" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/3 animate-pulse rounded bg-accent" />
                  <div className="h-2.5 w-full animate-pulse rounded bg-accent" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            {q ? "No chats match" : show !== "all" ? "Nothing here right now" : "No chats yet"}
            <div className="mt-2 text-xs">
              <Button variant="link" className="h-auto p-0 text-primary" onClick={onNewChat}>
                Start your first chat
              </Button>
            </div>
          </div>
        )}

        {filtered.map((item, i) => {
          const active = selectedId === item.conversation._id;
          const other = item.conversation.kind === "chat" && item.conversation.chatType === "direct"
            ? item.members.find((m) => m?._id !== myId)
            : null;
          const presence = other ? presenceMap[other._id] : null;
          const typing = typingMap[item.conversation._id] ?? [];
          const isChannel = item.conversation.kind === "channel";

          return (
            <motion.button
              key={item.conversation._id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
              onClick={() => onSelect(item.conversation._id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setCtxMenu({
                  id: item.conversation._id,
                  x: e.clientX,
                  y: e.clientY,
                  pinned: !!item.membership.isPinned,
                  muted: !!item.membership.isMuted,
                });
              }}
              style={{ "--t": toneFor(other?._id ?? item.conversation._id, item.conversation.kind) } as CSSProperties}
              aria-current={active ? "true" : undefined}
              className={cn(
                // a plain app row, like WhatsApp and Zoho Cliq: avatar, then name/time over the last message, hairline below
                "group flex w-full items-center gap-3 pl-4 text-left transition-colors hover:bg-accent active:bg-accent",
                active && "bg-accent",
              )}
            >
              {isChannel ? (
                item.conversation.image ? (
                  <GroupAvatar image={item.conversation.image} name={item.conversation.name} isChannel size="lg" />
                ) : (
                  <div className="tone-dot grid size-12 shrink-0 place-items-center rounded-2xl border-2 border-[var(--sticker-border)] text-[#121212]">
                    <Hash className="size-4" />
                  </div>
                )
              ) : item.conversation.chatType === "group" ? (
                <GroupAvatar image={item.conversation.image} name={item.conversation.name} size="lg" />
              ) : (
                <UserAvatar user={other ?? undefined} presence={presence} size="lg" showStatus />
              )}

              <div className="min-w-0 flex-1 border-b border-border/60 py-3 pr-4 group-last:border-b-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("truncate text-[15px]", item.unread > 0 || active ? "font-extrabold" : "font-semibold")}>
                    {conversationTitle(item, myId)}
                  </span>
                  <span className={cn("shrink-0 text-[11px]", item.unread > 0 ? "font-bold text-primary" : "text-muted-foreground")}>
                    {item.lastMessage ? formatTime(item.lastMessage.createdAt ?? 0) : ""}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  {typing.length > 0 ? (
                    <span className="truncate text-xs italic text-primary">
                      {typing.map((t) => t.name ?? "Someone").join(", ")} typing…
                    </span>
                  ) : (
                    <span className={cn("truncate text-[13px]", item.unread > 0 ? "font-semibold text-foreground" : "text-muted-foreground")}>
                      {previewText(item, myId)}
                    </span>
                  )}
                  {item.unread > 0 && (
                    <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                      {item.unread}
                    </span>
                  )}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* phones get the floating New chat button instead (AppChats) */}
      <div className="hidden shrink-0 border-t border-border/70 p-2.5 lg:block">
        <Button
          className="h-11 w-full gap-2"
          onClick={onNewChat}
        >
          <MessageSquarePlus className="size-4" /> New message
        </Button>
      </div>

      {/* Right-click context menu */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setCtxMenu(null)} />
          <div
            className="fixed z-50 min-w-[180px] overflow-hidden rounded-xl border border-border/80 bg-popover shadow-2xl"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
          >
            <button
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs transition-colors hover:bg-accent"
              onClick={async () => {
                try {
                  await togglePin({ conversationId: ctxMenu.id as any, pinned: !ctxMenu.pinned });
                  toast.success(ctxMenu.pinned ? "Unpinned" : "Pinned to top");
                } catch (e) { toast.error(e instanceof Error ? errorMessage(e) : "Failed"); }
                setCtxMenu(null);
              }}
            >
              {ctxMenu.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
              {ctxMenu.pinned ? "Unpin" : "Pin to top"}
            </button>
            <button
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs transition-colors hover:bg-accent"
              onClick={async () => {
                try {
                  await setMuted({ conversationId: ctxMenu.id as any, muted: !ctxMenu.muted });
                  toast.success(ctxMenu.muted ? "Unmuted" : "Muted");
                } catch (e) { toast.error(e instanceof Error ? errorMessage(e) : "Failed"); }
                setCtxMenu(null);
              }}
            >
              {ctxMenu.muted ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
              {ctxMenu.muted ? "Unmute" : "Mute"}
            </button>
            <button
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs transition-colors hover:bg-accent"
              onClick={async () => {
                try {
                  await archiveConv({ conversationId: ctxMenu.id as any, archived: true });
                  toast.success("Archived");
                } catch (e) { toast.error(e instanceof Error ? errorMessage(e) : "Failed"); }
                setCtxMenu(null);
              }}
            >
              <Archive className="size-3.5" /> Archive
            </button>
            <button
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-destructive transition-colors hover:bg-accent"
              onClick={async () => {
                const id = ctxMenu.id;
                setCtxMenu(null);
                if (!window.confirm("Delete this chat for you? Its messages disappear from your view. Other people keep theirs.")) return;
                try {
                  await deleteChat({ conversationId: id as any });
                  toast.success("Chat deleted");
                } catch (e) { toast.error(e instanceof Error ? errorMessage(e) : "Failed"); }
              }}
            >
              <Trash2 className="size-3.5" /> Delete chat
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function conversationTitle(
  item: ConversationItem,
  myId?: string,
): string {
  const c = item.conversation;
  if (c.kind === "channel") return `#${c.name}`;
  if (c.chatType === "group") return c.name || "Group chat";
  const other = item.members.find((m) => m?._id !== myId);
  return displayName(other ?? null);
}

function previewText(item: ConversationItem, myId?: string): string {
  const lm = item.lastMessage;
  if (!lm) return "No messages yet";
  if (lm.kind === "system") return lm.body;
  const mine = lm.senderId === myId;
  const prefix = mine ? "You: " : "";
  if (lm.kind === "file") return `${prefix}📎 Shared a file`;
  if (lm.kind === "voice") return `${prefix}🎤 Voice message`;
  if (lm.kind === "poll") return `${prefix}📊 New poll`;
  return `${prefix}${lm.body}`;
}
