import { GroupAvatar } from "@/components/chat/GroupAvatar";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { displayName, formatTime, timeAgo } from "@/lib/format";
import { effectiveStatus, isOnline, type PresenceLike } from "@/lib/presence";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { Hash, MessageSquarePlus, Mic, Pin, PinOff, Search, Volume2, VolumeX, Archive, ArchiveRestore } from "lucide-react";
import { useMutation } from "convex/react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

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
}

export function ConversationList({
  items,
  selectedId,
  myId,
  presenceMap,
  typingMap,
  onSelect,
  onNewChat,
  loading,
}: Props) {
  const [q, setQ] = useState("");
  const [ctxMenu, setCtxMenu] = useState<{ id: string; x: number; y: number; pinned: boolean; muted: boolean } | null>(null);
  const setMuted = useMutation(api.conversations.setMuted);
  const togglePin = useMutation(api.conversations.togglePin);
  const archiveConv = useMutation(api.conversations.archiveConversation);

  const filtered = useMemo(() => {
    if (!items) return [];
    const query = q.toLowerCase().trim();
    if (!query) return items;
    return items.filter((item) => {
      const name = conversationTitle(item, myId).toLowerCase();
      const preview = item.lastMessage?.body.toLowerCase() ?? "";
      return name.includes(query) || preview.includes(query);
    });
  }, [items, q, myId]);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search conversations…"
            className="h-9 rounded-xl pl-9 text-sm"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {loading && (
          <div className="space-y-2 p-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl p-2.5">
                <div className="size-10 animate-pulse rounded-full bg-accent" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/3 animate-pulse rounded bg-accent" />
                  <div className="h-2.5 w-full animate-pulse rounded bg-accent/70" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            {q ? "No conversations match" : "No conversations yet"}
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
              className={cn(
                "mb-1 flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-all",
                active
                  ? "bg-primary/12 shadow-[inset_0_0_0_1px_rgba(212,175,55,0.25)]"
                  : "hover:bg-accent/60",
              )}
            >
              {isChannel ? (
                item.conversation.image ? (
                  <GroupAvatar image={item.conversation.image} name={item.conversation.name} isChannel size="md" />
                ) : (
                  <div
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-xl",
                      active ? "bg-primary/20 text-primary" : "bg-accent text-muted-foreground",
                    )}
                  >
                    <Hash className="size-4" />
                  </div>
                )
              ) : item.conversation.chatType === "group" ? (
                <GroupAvatar image={item.conversation.image} name={item.conversation.name} size="md" />
              ) : (
                <UserAvatar user={other ?? undefined} presence={presence} size="md" showStatus />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("truncate text-sm", active ? "font-semibold" : "font-medium")}>
                    {conversationTitle(item, myId)}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {item.lastMessage ? formatTime(item.lastMessage.createdAt ?? 0) : ""}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  {typing.length > 0 ? (
                    <span className="truncate text-xs italic text-primary">
                      {typing.map((t) => t.name ?? "Someone").join(", ")} typing…
                    </span>
                  ) : (
                    <span className="truncate text-xs text-muted-foreground">
                      {previewText(item, myId)}
                    </span>
                  )}
                  {item.unread > 0 && (
                    <span className="grid min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                      {item.unread}
                    </span>
                  )}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-border/70 p-2.5">
        <Button
          className="h-10 w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
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
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs transition-colors hover:bg-accent/60"
              onClick={async () => {
                try {
                  await togglePin({ conversationId: ctxMenu.id as any, pinned: !ctxMenu.pinned });
                  toast.success(ctxMenu.pinned ? "Unpinned" : "Pinned to top");
                } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                setCtxMenu(null);
              }}
            >
              {ctxMenu.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
              {ctxMenu.pinned ? "Unpin" : "Pin to top"}
            </button>
            <button
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs transition-colors hover:bg-accent/60"
              onClick={async () => {
                try {
                  await setMuted({ conversationId: ctxMenu.id as any, muted: !ctxMenu.muted });
                  toast.success(ctxMenu.muted ? "Unmuted" : "Muted");
                } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                setCtxMenu(null);
              }}
            >
              {ctxMenu.muted ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
              {ctxMenu.muted ? "Unmute" : "Mute"}
            </button>
            <button
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs transition-colors hover:bg-accent/60"
              onClick={async () => {
                try {
                  await archiveConv({ conversationId: ctxMenu.id as any, archived: true });
                  toast.success("Archived");
                } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                setCtxMenu(null);
              }}
            >
              <Archive className="size-3.5" /> Archive
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
