import type { CSSProperties } from "react";
import { api } from "@/convex/_generated/api";
import { ConversationList, conversationTitle } from "@/components/chat/ConversationList";
import { GroupAvatar } from "@/components/chat/GroupAvatar";
import {
  MessageBubble,
  conversationName,
  type ChatMessage,
} from "@/components/chat/MessageBubble";
import { MessageComposer } from "@/components/chat/MessageComposer";
import { UserAvatar } from "@/components/UserAvatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { displayName, formatBytes, formatDayLabel, isSameDay } from "@/lib/format";
import { effectiveStatus, isOnline, presenceDotClass, presenceLabel } from "@/lib/presence";
import { prepareAvatarImage, uploadFile } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { toneFor } from "@/lib/tone";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowDown,
  Camera,
  Crown,
  FileText,
  Hash,
  Info,
  Loader2,
  MessageSquarePlus,
  Mic,
  Pencil,
  Phone,
  Pin,
  Send,
  Shield,
  Users,
  Video,
  X,
  ArrowLeft,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

const PAGE_SIZE = 50;

export function ChatView({
  conversationId,
  onBack,
}: {
  conversationId: string;
  onBack?: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const myId = user?._id ?? "";

  const detail = useQuery(api.conversations.detail, { conversationId: conversationId as any });
  const conversations = useQuery(api.conversations.list);
  const presenceAll = useQuery(api.users.presenceAll);
  const typing = useQuery(api.conversations.typingIn, { conversationId: conversationId as any });
  const markRead = useMutation(api.conversations.markRead);
  const startCall = useMutation(api.calls.start);

  const [pages, setPages] = useState<ChatMessage[][]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const page = useQuery(api.messages.list, {
    conversationId: conversationId as any,
    cursor: cursor ?? undefined,
  });

  const [replyTo, setReplyTo] = useState<{ id: string; body: string; senderName: string } | null>(null);
  const [editTarget, setEditTarget] = useState<{ id: string; body: string } | null>(null);
  const [thread, setThread] = useState<ChatMessage | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const [forwardTarget, setForwardTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; own: boolean } | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<ChatMessage[] | null>(null);

  const searchResults = useQuery(
    api.messages.searchInConversation,
    searchQ.trim().length >= 2 ? { conversationId: conversationId as any, query: searchQ } : "skip",
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const deleteForEveryone = useMutation(api.messages.deleteForEveryone);
  const deleteForMe = useMutation(api.messages.deleteForMe);
  const forward = useMutation(api.messages.forward);
  const send = useMutation(api.messages.send);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const setConversationAvatar = useMutation(api.conversations.setConversationAvatar);
  const setMemberRole = useMutation(api.conversations.setMemberRole);
  const updateGroupPolicy = useMutation(api.conversations.updateGroupPolicy);
  const renameConversation = useMutation(api.conversations.renameConversation);

  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  // reset on conversation change
  useEffect(() => {
    setPages([]);
    setCursor(null);
    setHasMore(true);
    setReplyTo(null);
    setEditTarget(null);
    setThread(null);
    setSearchQ("");
    setSearchHits(null);
    stickToBottom.current = true;
  }, [conversationId]);

  // accumulate pages
  useEffect(() => {
    if (!page) return;
    if (cursor === null) {
      setPages([page.messages as ChatMessage[]]);
      setHasMore(page.hasMore);
    } else {
      setPages((prev) => [page.messages as ChatMessage[], ...prev]);
      setHasMore(page.hasMore);
    }
    setLoadingMore(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // mark read when new messages arrive
  useEffect(() => {
    if (!pages.length || !conversationId) return;
    const newest = pages[pages.length - 1];
    const last = newest[newest.length - 1];
    if (last && last.senderId !== myId) {
      markRead({ conversationId: conversationId as any }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, conversationId, myId]);

  // scroll handling
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [pages, thread]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (el.scrollTop < 120 && hasMore && !loadingMore) {
      setLoadingMore(true);
      setCursor(page?.nextCursor ?? null);
    }
  };

  const messages = useMemo(() => pages.flat(), [pages]);

  // typing map for the list side
  const presenceMap = useMemo(() => {
    const map: Record<string, NonNullable<typeof presenceAll>[number]> = {};
    for (const p of presenceAll ?? []) map[p.userId] = p;
    return map;
  }, [presenceAll]);

  const typingMap = useMemo(() => {
    const map: Record<string, { _id: string; name?: string | null }[]> = {};
    if (typing && typing.length > 0) map[conversationId] = typing;
    return map;
  }, [typing, conversationId]);

  const handleReply = useCallback((msg: ChatMessage) => {
    setReplyTo({
      id: msg._id,
      body: msg.body || "📎 Attachment",
      senderName: msg.sender?.name ?? "Someone",
    });
  }, []);

  // custom events: forward & delete
  useEffect(() => {
    const onForward = (e: Event) => {
      const id = (e as CustomEvent).detail as string;
      setForwardTarget(id);
    };
    const onDelete = (e: Event) => {
      setDeleteTarget((e as CustomEvent).detail as { id: string; own: boolean });
    };
    window.addEventListener("shine-forward", onForward);
    window.addEventListener("shine-delete", onDelete);
    return () => {
      window.removeEventListener("shine-forward", onForward);
      window.removeEventListener("shine-delete", onDelete);
    };
  }, []);

  const canDeleteForEveryone = user?.role === "super_admin" || user?.role === "admin";

  const conversation = detail?.conversation;
  const members = detail?.members ?? [];
  const other = conversation?.kind === "chat" && conversation.chatType === "direct"
    ? members.find((m) => m._id !== myId)
    : null;
  const otherPresence = other ? presenceMap[other._id] : null;
  const isChannel = conversation?.kind === "channel";

  const myRole = detail?.myRole;
  const isGroupAdmin = myRole === "owner" || myRole === "admin";
  const isGroup = conversation?.kind === "chat" && conversation.chatType === "group";

  const handleAvatarPick = async (file: File | undefined) => {
    if (!file || avatarBusy) return;
    setAvatarBusy(true);
    try {
      const ready = await prepareAvatarImage(file);
      const up = await uploadFile(ready, () => generateUploadUrl());
      await setConversationAvatar({
        conversationId: conversationId as any,
        storageId: up.storageId,
        url: up.url,
      });
      toast.success("Group photo updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Photo upload failed");
    } finally {
      setAvatarBusy(false);
    }
  };

  const canEditPhoto =
    (isGroup && isGroupAdmin) ||
    (isChannel && isGroupAdmin) ||
    (conversation?.policies as any)?.whoCanEditInfo === "everyone";

  const handlePromote = async (uid: string) => {
    try {
      await setMemberRole({ conversationId: conversationId as any, userId: uid as any, role: "admin" });
      toast.success("Promoted to group admin");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Promotion failed");
    }
  };
  const handleDemote = async (uid: string) => {
    try {
      await setMemberRole({ conversationId: conversationId as any, userId: uid as any, role: "member" });
      toast.success("Admin rights removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Demotion failed");
    }
  };

  const handleRename = async () => {
    if (!renameValue.trim() || !conversation) return;
    try {
      await renameConversation({
        conversationId: conversationId as any,
        name: renameValue.trim(),
      });
      setRenaming(false);
      toast.success("Renamed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rename failed");
    }
  };

  const typingNames = (typing ?? []).filter((t) => t._id !== myId).map((t) => t.name ?? "Someone");
  const statusLine = typingNames.length
    ? `${typingNames.join(", ")} typing…`
    : other?.source === "joi"
      ? `AI · ${other.customStatus || "Joi is an AI. It can make mistakes."}`
      : other
      ? // like Gmail's dot plus WhatsApp's status line: "Active · 📅 In a meeting"
        [
          isOnline(otherPresence)
            ? presenceLabel(otherPresence)
            : `Last seen ${other?.lastSeen ? new Date(other.lastSeen).toLocaleString() : "recently"}`,
          otherPresence?.customStatus || other.customStatus,
        ]
          .filter(Boolean)
          .join(" · ")
      : isChannel
        ? `${members.length} members`
        : "";

  const handleCall = (kind: "audio" | "video") => {
    if (conversation?.kind !== "chat" || conversation.chatType !== "direct") {
      toast("Calls are available in direct conversations");
      return;
    }
    startCall({ conversationId: conversationId as any, kind })
      .then(() => toast(kind === "video" ? "Calling…" : "Calling…"))
      .catch((e) => toast(e instanceof Error ? e.message : "Call failed"));
  };

  const handleSendThreadReply = async (body: string) => {
    if (!thread) return;
    await send({
      conversationId: conversationId as any,
      body,
      kind: "text",
      parentId: thread._id as any,
    }).catch(() => {});
  };

  const threadReplies = useMemo(
    () => messages.filter((m) => m.parentId === thread?._id && !m.deleted),
    [messages, thread],
  );

  // ---- render --------------------------------------------------------------

  if (!conversation) {
    return (
      <div className="grid h-full place-items-center text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="flex h-full min-w-0"
      style={{ "--t": toneFor(other?._id ?? conversation._id, conversation.kind) } as CSSProperties}
    >
      {/* MAIN THREAD */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* header: a band in the chat's colour, like an opened Dejoiy Mail card */}
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b-2 border-[var(--sticker-border)] bg-[color-mix(in_oklch,var(--t)_22%,var(--card))] px-4">
          <div className="flex min-w-0 items-center gap-3">
            {onBack && (
              <Button variant="ghost" size="icon-sm" onClick={onBack} className="lg:hidden" aria-label="Back to chats">
                <ArrowLeft className="size-5" />
              </Button>
            )}
            {isGroup || isChannel ? (
              <GroupAvatar
                image={conversation.image}
                name={conversation.name}
                isChannel={isChannel}
                size="md"
                editable={canEditPhoto}
                onPick={() => avatarInputRef.current?.click()}
              />
            ) : (
              <UserAvatar
                user={other ?? undefined}
                presence={otherPresence}
                size="md"
                showStatus={!!other}
              />
            )}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                handleAvatarPick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {renaming ? (
                  <form
                    onSubmit={(e) => { e.preventDefault(); handleRename(); }}
                    className="flex items-center gap-1.5"
                  >
                    <Input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => { if (!renameValue.trim()) setRenaming(false); }}
                      className="h-7 w-48 text-sm font-semibold"
                      maxLength={100}
                    />
                    <Button size="sm" type="submit" className="h-7 px-2 text-xs" disabled={!renameValue.trim()}>Save</Button>
                    <Button size="sm" variant="ghost" type="button" className="h-7 px-2 text-xs" onClick={() => setRenaming(false)}>Cancel</Button>
                  </form>
                ) : (
                  <span
                    className={cn(
                      "truncate text-sm font-semibold",
                      (isGroup || isChannel) && isGroupAdmin && "cursor-pointer hover:text-primary transition-colors",
                    )}
                    onClick={() => {
                      if ((isGroup || isChannel) && isGroupAdmin) {
                        setRenameValue(conversation.name);
                        setRenaming(true);
                      }
                    }}
                    title={(isGroup || isChannel) && isGroupAdmin ? "Click to rename" : undefined}
                  >
                    {conversationName(conversation, members, myId)}
                  </span>
                )}
                {conversation.channelKind && conversation.channelKind !== "channel" && (
                  <Badge className="bg-primary/10 text-primary hover:bg-primary/15">
                    {conversation.channelKind}
                  </Badge>
                )}
              </div>
              <div className="flex min-w-0 items-center gap-1 text-[12px] text-muted-foreground">
                {typingNames.length > 0 ? (
                  <span className="truncate text-primary">● {statusLine}</span>
                ) : otherPresence && isOnline(otherPresence) ? (
                  <>
                    <span className={cn("size-1.5 shrink-0 rounded-full", presenceDotClass(otherPresence))} />
                    <span className="truncate">{statusLine}</span>
                  </>
                ) : (
                  <span className="truncate">{statusLine}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon" className="size-9 text-muted-foreground" title="Audio call" onClick={() => handleCall("audio")}>
              <Phone className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-9 text-muted-foreground" title="Video call" onClick={() => handleCall("video")}>
              <Video className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("size-9", detailsOpen ? "text-primary" : "text-muted-foreground")}
              title="Details"
              onClick={() => setDetailsOpen((v) => !v)}
            >
              <Info className="size-4" />
            </Button>
          </div>
        </div>

        {/* search banner */}
        {searchQ.trim().length >= 2 && (
          <div className="flex items-center gap-2 border-b border-border/70 bg-accent/40 px-4 py-2 text-xs">
            <span className="text-muted-foreground">
              {searchHits ? `${searchHits.length} results` : "Searching…"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => {
                setSearchQ("");
                setSearchHits(null);
              }}
            >
              Clear
            </Button>
          </div>
        )}

        {/* messages */}
        <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto py-4">
          {loadingMore && (
            <div className="flex justify-center py-2">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {messages.map((msg, i) => {
            const prev = messages[i - 1];
            const showDay = !prev || !isSameDay(prev.createdAt, msg.createdAt);
            const showHeader =
              !isOwn(msg, myId) && (showDay || !prev || prev.senderId !== msg.senderId || prev.kind === "system");
            return (
              <div key={msg._id}>
                {showDay && (
                  <div className="my-4 flex justify-center">
                    <span className="rounded-full bg-accent/70 px-3 py-1 text-[10px] font-medium text-muted-foreground">
                      {formatDayLabel(msg.createdAt)}
                    </span>
                  </div>
                )}
                <MessageBubble
                  message={msg}
                  isOwn={isOwn(msg, myId)}
                  showHeader={showHeader}
                  conversationKind={conversation.kind}
                  onReply={handleReply}
                  onThreadOpen={setThread}
                  onEdit={(m) => setEditTarget({ id: m._id, body: m.body })}
                  onPreview={(url, name) => setPreview({ url, name })}
                />
              </div>
            );
          })}
          <div ref={bottomRef} className="h-2" />
        </div>

        {/* composer */}
        <MessageComposer
          conversationId={conversationId}
          onTyping={() => {}}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          editTarget={editTarget}
          onCancelEdit={() => {
            setEditTarget(null);
          }}
          members={members as any}
        />
      </div>

      {/* THREAD PANEL */}
      {thread && (
        <motion.aside
          initial={{ x: 320 }}
          animate={{ x: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="hidden w-80 shrink-0 flex-col border-l border-border/70 bg-background/40 md:flex"
        >
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
            <span className="text-sm font-semibold">Thread</span>
            <Button variant="ghost" size="icon-sm" onClick={() => setThread(null)}>
              <X className="size-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <MessageBubble
              message={thread}
              isOwn={isOwn(thread, myId)}
              showHeader
              conversationKind={conversation.kind}
              onReply={handleReply}
              onThreadOpen={() => {}}
              onEdit={(m) => setEditTarget({ id: m._id, body: m.body })}
              onPreview={(url, name) => setPreview({ url, name })}
            />
            <Separator className="my-3" />
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {threadReplies.length} repl{threadReplies.length === 1 ? "y" : "ies"}
            </div>
            {threadReplies.map((m) => (
              <MessageBubble
                key={m._id}
                message={m}
                isOwn={isOwn(m, myId)}
                showHeader
                conversationKind={conversation.kind}
                onReply={handleReply}
                onThreadOpen={() => {}}
                onEdit={(e) => setEditTarget({ id: e._id, body: e.body })}
                onPreview={(url, name) => setPreview({ url, name })}
              />
            ))}
          </div>
          <div className="border-t border-border/70 p-3">
            <ThreadComposer onSend={handleSendThreadReply} />
          </div>
        </motion.aside>
      )}

      {/* DETAILS PANEL */}
      {detailsOpen && (
        <motion.aside
          initial={{ x: 320 }}
          animate={{ x: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="hidden w-80 shrink-0 flex-col overflow-y-auto border-l border-border/70 bg-background/40 lg:flex"
        >
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
            <span className="text-sm font-semibold">Details</span>
            <Button variant="ghost" size="icon-sm" onClick={() => setDetailsOpen(false)}>
              <X className="size-4" />
            </Button>
          </div>
          <div className="space-y-6 p-4">
            {(isGroup || isChannel) && (
              <>
              <section>
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Camera className="size-3.5" /> Group photo
                </div>
                <div className="flex items-center gap-3">
                  <GroupAvatar
                    image={conversation.image}
                    name={conversation.name}
                    isChannel={isChannel}
                    size="lg"
                  />
                  <div className="flex flex-col gap-1.5">
                    <button
                      className="flex items-center gap-1.5 rounded-lg bg-accent/70 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                      disabled={avatarBusy}
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      <Camera className="size-3.5" />
                      {avatarBusy ? "Uploading…" : conversation.image ? "Change photo" : "Set photo"}
                    </button>
                    {conversation.image && (
                      <button
                        className="rounded-lg px-2.5 py-1.5 text-left text-xs text-rose-400 transition-colors hover:bg-rose-500/10"
                        onClick={async () => {
                          try {
                            await setConversationAvatar({ conversationId: conversationId as any, clear: true });
                            toast.success("Photo removed");
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Failed");
                          }
                        }}
                      >
                        Remove photo
                      </button>
                    )}
                    {!canEditPhoto && (
                      <span className="max-w-40 text-[10px] leading-snug text-muted-foreground">
                        Only group admins can change the photo
                      </span>
                    )}
                  </div>
                </div>
              </section>

              {isGroupAdmin && (
                <section>
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Pencil className="size-3.5" /> Rename
                  </div>
                  {renaming ? (
                    <form onSubmit={(e) => { e.preventDefault(); handleRename(); }} className="flex items-center gap-1.5">
                      <Input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="h-8 text-xs"
                        maxLength={100}
                      />
                      <Button size="sm" type="submit" className="h-8 px-2 text-xs" disabled={!renameValue.trim()}>Save</Button>
                      <Button size="sm" variant="ghost" type="button" className="h-8 px-2 text-xs" onClick={() => setRenaming(false)}>Cancel</Button>
                    </form>
                  ) : (
                    <button
                      onClick={() => { setRenameValue(conversation.name); setRenaming(true); }}
                      className="w-full rounded-lg bg-accent/70 px-2.5 py-2 text-left text-xs font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      {conversation.name}
                    </button>
                  )}
                </section>
              )}
              </>
            )}

            <section>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Users className="size-3.5" /> Members · {members.length}
              </div>
              <div className="space-y-2">
                {members.map((m) => {
                  const p = presenceMap[m._id];
                  const online = isOnline(p);
                  const mRole = (m as any).role;
                  const canManage =
                    isGroup && isGroupAdmin && m._id !== myId && mRole !== "owner";
                  const canDemote = canManage && mRole === "admin" && myRole === "owner";
                  return (
                    <div
                      key={m._id}
                      className="group flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left transition-colors hover:bg-accent/60"
                    >
                      <button
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                        onClick={() => navigate(`/app/chats?new=${m._id}`)}
                      >
                        <UserAvatar user={m} presence={p} size="sm" showStatus />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm">{displayName(m)}</span>
                            {mRole === "owner" && (
                              <Crown className="size-3 shrink-0 text-amber-400" />
                            )}
                            {mRole === "admin" && (
                              <Shield className="size-3 shrink-0 text-primary" />
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {mRole === "owner"
                              ? "Creator"
                              : mRole === "admin"
                                ? "Admin"
                                : m.designation || m.department || (online ? "Online" : "Offline")}
                          </div>
                        </div>
                        {m._id === myId && <Badge className="bg-accent text-muted-foreground">You</Badge>}
                      </button>
                      {canManage && mRole === "member" && (
                        <button
                          className="shrink-0 rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary opacity-0 transition-opacity hover:bg-primary/20 group-hover:opacity-100"
                          onClick={() => handlePromote(m._id)}
                        >
                          Make admin
                        </button>
                      )}
                      {canDemote && (
                        <button
                          className="shrink-0 rounded-lg border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
                          title="Only the creator can remove an admin"
                          onClick={() => handleDemote(m._id)}
                        >
                          Remove admin
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {isGroup && isGroupAdmin && (
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Hover a member to promote them to admin. Admins can manage members and
                  group settings — only the creator can remove an admin.
                </p>
              )}
            </section>

            {isGroup && isGroupAdmin && (
              <section>
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Shield className="size-3.5" /> Group policies
                </div>
                <div className="space-y-2">
                  <PolicyRow
                    label="Who can send messages"
                    value={((conversation.policies as any)?.whoCanSend ?? "everyone") as string}
                    onChange={async (val) => {
                      await updateGroupPolicy({
                        conversationId: conversationId as any,
                        policies: { whoCanSend: val as "everyone" | "admins" },
                      }).catch((e) => toast.error(e instanceof Error ? e.message : "Failed"));
                    }}
                  />
                  <PolicyRow
                    label="Who can manage members"
                    value={((conversation.policies as any)?.whoCanManageMembers ?? "admins") as string}
                    onChange={async (val) => {
                      await updateGroupPolicy({
                        conversationId: conversationId as any,
                        policies: { whoCanManageMembers: val as "everyone" | "admins" },
                      }).catch((e) => toast.error(e instanceof Error ? e.message : "Failed"));
                    }}
                  />
                  <PolicyRow
                    label="Who can edit group info"
                    value={((conversation.policies as any)?.whoCanEditInfo ?? "admins") as string}
                    onChange={async (val) => {
                      await updateGroupPolicy({
                        conversationId: conversationId as any,
                        policies: { whoCanEditInfo: val as "everyone" | "admins" },
                      }).catch((e) => toast.error(e instanceof Error ? e.message : "Failed"));
                    }}
                  />
                </div>
              </section>
            )}

            <section>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Pin className="size-3.5" /> Pinned · {(detail?.pinnedMessages ?? []).length}
              </div>
              {(!detail?.pinnedMessages || detail.pinnedMessages.length === 0) && (
                <p className="text-xs text-muted-foreground">Nothing pinned yet. Hover a message and hit the pin icon.</p>
              )}
              <div className="space-y-2">
                {(detail?.pinnedMessages ?? [])
                  .filter((p): p is NonNullable<typeof p> => !!p)
                  .map((p) => (
                    <div key={p._id} className="rounded-xl border border-border/70 bg-background/50 p-2.5">
                      <p className="line-clamp-2 text-xs">{p.body || "📎 Attachment"}</p>
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {p.sender ? displayName(p.sender) : "Unknown"} · pinned
                      </div>
                    </div>
                  ))}
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <FileText className="size-3.5" /> Shared files · {(detail?.files ?? []).length}
              </div>
              <div className="space-y-2">
                {detail?.files.map((f) => (
                  <a
                    key={f._id}
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-background/50 p-2 transition-colors hover:border-primary/40"
                  >
                    <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
                      <FileText className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">{f.name}</div>
                      <div className="text-[10px] text-muted-foreground">{formatBytes(f.size)}</div>
                    </div>
                  </a>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Search in conversation
              </div>
              <Input
                value={searchQ}
                onChange={(e) => {
                  setSearchQ(e.target.value);
                  setSearchHits((searchResults as unknown as ChatMessage[] | null | undefined) ?? null);
                }}
                placeholder="Type to search…"
                className="h-9 text-sm"
              />
              {searchHits && searchHits.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {searchHits.slice(0, 6).map((h) => (
                    <button
                      key={h._id}
                      className="w-full rounded-lg bg-accent/60 p-2 text-left text-xs transition-colors hover:bg-accent"
                      onClick={() => setSearchQ("")}
                    >
                      <span className="font-medium">{h.sender ? displayName(h.sender) : "Unknown"}: </span>
                      <span className="text-muted-foreground">{h.body}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        </motion.aside>
      )}

      {/* IMAGE PREVIEW */}
      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="max-w-3xl border-0 bg-black/90 p-2">
          {preview && (
            <img src={preview.url} alt={preview.name} className="max-h-[80vh] w-full rounded-xl object-contain" />
          )}
        </DialogContent>
      </Dialog>

      {/* FORWARD DIALOG */}
      <Dialog open={!!forwardTarget} onOpenChange={(v) => !v && setForwardTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Forward message</DialogTitle>
            <DialogDescription>Choose a conversation to forward this message to.</DialogDescription>
          </DialogHeader>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {(conversations ?? [])
              .filter((c) => c.conversation._id !== conversationId)
              .map((c) => (
                <button
                  key={c.conversation._id}
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-accent/60"
                  onClick={async () => {
                    if (forwardTarget) {
                      await forward({
                        messageId: forwardTarget as any,
                        toConversationId: c.conversation._id as any,
                      }).catch((e) => toast(e instanceof Error ? e.message : "Forward failed"));
                      toast("Message forwarded");
                    }
                    setForwardTarget(null);
                  }}
                >
                  {c.conversation.kind === "channel" ? (
                    <div className="grid size-9 place-items-center rounded-lg bg-primary/12 text-primary">
                      <Hash className="size-4" />
                    </div>
                  ) : (
                    <UserAvatar
                      user={c.members.find((m) => m._id !== myId) ?? undefined}
                      presence={presenceMap[(c.members.find((m) => m._id !== myId) ?? { _id: "" })._id]}
                      size="md"
                    />
                  )}
                  <span className="truncate text-sm font-medium">
                    {conversationTitle(c as any, myId)}
                  </span>
                </button>
              ))}
            {(!conversations || conversations.length <= 1) && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No other conversations yet.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* DELETE DIALOG */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message</AlertDialogTitle>
            <AlertDialogDescription>
              {canDeleteForEveryone
                ? "Delete for everyone, or only for you?"
                : "Enterprise chat protection: only Super Admins and Administrators can delete messages for everyone. You can delete this message for yourself — it stays on the server and remains auditable."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {canDeleteForEveryone && (
              <AlertDialogAction
                className="bg-rose-500 text-white hover:bg-rose-500"
                onClick={() => {
                  if (deleteTarget) {
                    deleteForEveryone({ messageId: deleteTarget.id as any })
                      .then(() => toast.success("Message deleted for everyone"))
                      .catch((e) => toast.error(e instanceof Error ? e.message : "Delete failed"));
                  }
                  setDeleteTarget(null);
                }}
              >
                Delete for everyone
              </AlertDialogAction>
            )}
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) deleteForMe({ messageId: deleteTarget.id as any }).catch(() => {});
                setDeleteTarget(null);
              }}
            >
              {canDeleteForEveryone && deleteTarget?.own ? "Delete for me" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function isOwn(msg: ChatMessage, myId: string): boolean {
  return msg.senderId === myId;
}

function PolicyRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-background/50 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex overflow-hidden rounded-lg border border-border/70">
        {["everyone", "admins"].map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={cn(
              "px-2.5 py-1 text-[10px] font-medium capitalize transition-colors",
              value === opt
                ? "bg-primary text-primary-foreground"
                : "bg-transparent text-muted-foreground hover:bg-accent",
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function ThreadComposer({ onSend }: { onSend: (body: string) => void }) {
  const [text, setText] = useState("");
  const send = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  };
  return (
    <div className="flex items-end gap-2">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Reply in thread…"
        className="h-10 text-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
      />
      <Button size="icon" className="size-10 shrink-0 bg-primary text-primary-foreground" onClick={send}>
        <Send className="size-4" />
      </Button>
    </div>
  );
}
