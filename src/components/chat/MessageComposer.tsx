import { api } from "@/convex/api";
import { EmojiPicker } from "@/components/chat/EmojiPicker";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { isHigherManagement } from "@/lib/permissions";
import { STICKERS } from "@/lib/emoji";
import { uploadBlob, uploadFile, type UploadResult } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@/convex/react";
import { motion } from "framer-motion";
import {
  AtSign,
  AudioLines,
  BarChart3,
  Code2,
  CornerDownLeft,
  Globe,
  Hash,
  Loader2,
  Mic,
  Paperclip,
  Send,
  Square,
  Sticker,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export interface MentionMember {
  _id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  designation?: string | null;
  employeeId?: string | null;
}

interface Props {
  conversationId: string;
  onTyping: (typing: boolean) => void;
  replyTo: { id: string; body: string; senderName: string } | null;
  onCancelReply: () => void;
  editTarget: { id: string; body: string } | null;
  onCancelEdit: () => void;
  members?: (MentionMember | null)[];
}

// God commands — "@all" tags every employee of your organization and "@allS"
// tags every user of the app. They are resolved server-side at send time
// (see convex/messages.ts), so they work in every chat, channel and meeting.
const GOD_COMMANDS = [
  {
    token: "@all",
    label: "Everyone in my org",
    hint: "Tag all employees of your organization",
    icon: <Users className="size-4" />,
  },
  {
    token: "@allS",
    label: "Everyone in the app",
    hint: "Tag every user of SHINE",
    icon: <Globe className="size-4" />,
  },
];

const SLASH_COMMANDS = [
  {
    cmd: "/md",
    hint: "Send as formatted markdown — # headings, **bold**, - lists, > quotes",
    icon: <Hash className="size-4" />,
  },
  {
    cmd: "/code",
    hint: "Send as a code block with a one-click copy button",
    icon: <Code2 className="size-4" />,
  },
];

export function MessageComposer({
  conversationId,
  onTyping,
  replyTo,
  onCancelReply,
  editTarget,
  onCancelEdit,
  members,
}: Props) {
  const { user } = useAuth();
  const send = useMutation(api.messages.send);
  const edit = useMutation(api.messages.edit);
  const createPoll = useMutation(api.messages.createPoll);
  const setTyping = useMutation(api.conversations.setTyping);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState<{ name: string; pct: number } | null>(null);
  const [pollOpen, setPollOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragCount = useRef(0);
  const [dragging, setDragging] = useState(false);

  // @mention + slash commands
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionKeepRef = useRef(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);

  // Search EVERY app user for @mentions — not just conversation members.
  const mentionSearch = useQuery(api.users.mentionSearch, {
    query: mentionQuery || undefined,
  });

  const filtered = useMemo(() => {
    const q = mentionQuery.toLowerCase().trim();
    const list = (members ?? []).filter(
      (m): m is MentionMember => !!m && m._id !== user?._id,
    );
    const extras = (mentionSearch ?? []).filter(
      (m) => !list.some((l) => String(l._id) === String(m._id)),
    );
    const merged = [...list, ...extras];
    if (!q) return merged;
    return merged.filter(
      (m) =>
        (m.name ?? "").toLowerCase().includes(q) ||
        (m.email ?? "").toLowerCase().includes(q) ||
        (m.employeeId ?? "").toLowerCase().includes(q),
    );
  }, [members, mentionSearch, mentionQuery, user?._id]);

  // @allS is a higher-management god command — hidden for everyone else.
  const godCommands = isHigherManagement(user)
    ? GOD_COMMANDS
    : GOD_COMMANDS.filter((c) => c.token !== "@allS");
  const mentionListLength = godCommands.length + filtered.length;

  const closePopovers = () => {
    setMentionOpen(false);
    mentionKeepRef.current = false;
    setSlashOpen(false);
  };

  const analyzeText = (value: string) => {
    const lastAt = value.lastIndexOf("@");
    const prevChar = lastAt > 0 ? value[lastAt - 1] : "";
    const atTokenStart = lastAt === 0 || prevChar === " " || prevChar === "\n";
    if (atTokenStart && lastAt >= 0 && !value.slice(lastAt).includes("\n")) {
      mentionKeepRef.current = true;
    }
    if (lastAt < 0) mentionKeepRef.current = false;
    if (mentionKeepRef.current && lastAt >= 0) {
      setMentionQuery(value.slice(lastAt + 1).toLowerCase());
      setMentionOpen(true);
      setMentionIndex(0);
    } else {
      setMentionOpen(false);
    }
    setSlashOpen(value.trim() === "/");
    if (value.trim() !== "/") setSlashIndex(0);
  };

  const insertMention = (m: MentionMember) => {
    const at = text.lastIndexOf("@");
    const label = m.name ?? m.email ?? "member";
    setText((t) => t.slice(0, Math.max(at, 0)) + "@" + label + " ");
    closePopovers();
  };

  const insertGodCommand = (token: string) => {
    const at = text.lastIndexOf("@");
    setText((t) => t.slice(0, Math.max(at, 0)) + token + " ");
    closePopovers();
  };

  const insertSlash = (i: number) => {
    setText(i === 0 ? "/md " : "/code ");
    closePopovers();
  };

  // voice recording
  const [recording, setRecording] = useState(false);
  const [recSec, setRecSec] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (editTarget) setText(editTarget.body);
  }, [editTarget]);

  useEffect(() => () => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
  }, []);

  const fireTyping = useCallback(() => {
    setTyping({ conversationId: conversationId as any, isTyping: true }).catch(() => {});
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      setTyping({ conversationId: conversationId as any, isTyping: false }).catch(() => {});
    }, 2500);
  }, [conversationId, setTyping]);

  const handleSendText = async (body?: string) => {
    const raw = body ?? text;
    let content = raw.trim();
    if (!content || sending) return;
    // /md → send as markdown, /code → send wrapped in a fenced code block
    if (/^\/md\b/.test(content)) {
      content = content.replace(/^\/md\s*/, "");
    } else if (/^\/code\b/.test(content)) {
      const rest = raw.replace(/^\/code\s*/, "").replace(/\s+$/, "");
      content = rest ? "```\n" + rest + "\n```" : "";
    }
    if (!content) return;
    closePopovers();
    if (editTarget) {
      setSending(true);
      await edit({ messageId: editTarget.id as any, body: content }).catch((e) =>
        toast(e instanceof Error ? e.message : "Edit failed"),
      );
      setSending(false);
      setText("");
      onCancelEdit();
      return;
    }
    setSending(true);
    try {
      await send({
        conversationId: conversationId as any,
        body: content,
        kind: "text",
      });
      setText("");
      setTyping({ conversationId: conversationId as any, isTyping: false }).catch(() => {});
    } catch (e) {
      toast(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading({ name: list[0].name, pct: 0 });
    try {
      const results: UploadResult[] = [];
      for (const f of list) {
        const res = await uploadFile(f, () => generateUploadUrl(), (pct) =>
          setUploading({ name: f.name, pct }),
        );
        results.push(res);
      }
      await send({
        conversationId: conversationId as any,
        body: results.length > 1 ? `${results.length} files shared` : "",
        kind: "file",
        attachments: results.map((r) => ({
          storageId: r.storageId,
          url: r.url,
          name: r.name,
          mimeType: r.mimeType,
          size: r.size,
          kind: r.kind,
        })),
      });
      toast(`Shared ${results.length} file${results.length > 1 ? "s" : ""}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (chunksRef.current.length === 0) return;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        setUploading({ name: "voice-note.webm", pct: 100 });
        try {
          const res = await uploadBlob(blob, "voice-note.webm", rec.mimeType || "audio/webm", () =>
            generateUploadUrl(),
          );
          await send({
            conversationId: conversationId as any,
            body: "",
            kind: "voice",
            attachments: [
              { storageId: res.storageId, url: res.url, name: "Voice message", mimeType: res.mimeType, size: res.size, kind: "audio" },
            ],
          });
        } catch {
          toast("Voice message failed to upload");
        } finally {
          setUploading(null);
        }
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      setRecSec(0);
      recTimerRef.current = setInterval(() => setRecSec((s) => s + 1), 1000);
    } catch {
      toast("Microphone access denied");
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
    if (recTimerRef.current) clearInterval(recTimerRef.current);
  };

  return (
    <div className="shrink-0 px-4 pb-4">
      {/* reply / edit banner */}
      {(replyTo || editTarget) && (
        <div className="mb-2 flex items-center gap-2 rounded-t-xl border border-b-0 border-border/80 bg-accent/60 px-3 py-2">
          <span className="text-primary">
            {editTarget ? <X className="size-4" /> : <CornerUpRightIcon />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold text-primary">
              {editTarget ? "Editing message" : `Replying to ${replyTo?.senderName}`}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">
              {editTarget?.body ?? replyTo?.body}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => (editTarget ? onCancelEdit() : onCancelReply())}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      {/* upload progress */}
      {uploading && (
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-border/80 bg-background/50 px-3 py-2">
          <Loader2 className="size-4 animate-spin text-primary" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs">{uploading.name}</div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-accent">
              <div className="h-full bg-primary transition-all" style={{ width: `${uploading.pct}%` }} />
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground">{uploading.pct}%</span>
        </div>
      )}

      {/* recording banner */}
      {recording && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-2 flex items-center gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2.5"
        >
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-rose-500" />
          </span>
          <span className="font-mono text-sm tabular-nums">{`0:${String(recSec).padStart(2, "0")}`}</span>
          <span className="flex-1 text-xs text-muted-foreground">Recording voice message…</span>
          <Button size="sm" variant="outline" className="text-rose-500" onClick={stopRecording}>
            <Square className="size-3.5" /> Stop
          </Button>
        </motion.div>
      )}

      <div
        className={cn(
          "relative flex items-end gap-1.5 rounded-2xl border bg-background/60 p-2 transition-colors",
          dragging ? "border-primary/60 ring-2 ring-primary/20" : "border-border/80",
        )}
        onDragEnter={(e) => {
          e.preventDefault();
          dragCount.current++;
          setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => {
          dragCount.current--;
          if (dragCount.current <= 0) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragCount.current = 0;
          setDragging(false);
          if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {/* slash command menu — type "/" */}
        {slashOpen && (
          <div className="absolute bottom-full left-0 right-0 z-30 mb-2 overflow-hidden rounded-xl border border-border/80 bg-popover p-1 shadow-2xl">
            <div className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Slash commands
            </div>
            {SLASH_COMMANDS.map((c, i) => (
              <button
                key={c.cmd}
                onMouseEnter={() => setSlashIndex(i)}
                onClick={() => insertSlash(i)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors",
                  slashIndex === i ? "bg-accent" : "hover:bg-accent/60",
                )}
              >
                <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
                  {c.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-xs font-semibold text-primary">{c.cmd}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{c.hint}</div>
                </div>
                <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}

        {/* @mention picker — type "@" */}
        {mentionOpen && (
          <div className="absolute bottom-full left-0 right-0 z-30 mb-2 overflow-hidden rounded-xl border border-border/80 bg-popover shadow-2xl">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Mention someone — or use a god command
              </span>
              <AtSign className="size-3.5 text-primary" />
            </div>
            <div className="max-h-60 overflow-y-auto p-1">
              {/* God commands — tag entire teams / the whole app */}
              {godCommands.map((c, i) => (
                <button
                  key={c.token}
                  onMouseEnter={() => setMentionIndex(i)}
                  onClick={() => insertGodCommand(c.token)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors",
                    mentionIndex === i ? "bg-accent" : "hover:bg-accent/60",
                  )}
                >
                  <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
                    {c.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs font-semibold text-primary">{c.token}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{c.hint}</div>
                  </div>
                  {mentionIndex === i && <CornerDownLeft className="size-3.5 shrink-0 text-primary" />}
                </button>
              ))}
              <div className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                People{mentionQuery ? ` matching “${mentionQuery}”` : " in SHINE"}
              </div>
              {filtered.length === 0 && (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                  {godCommands.length === 1
                    ? "No people found — use @all to tag your whole team"
                    : "No people found — use @all or @allS to tag a whole team"}
                </div>
              )}
              {filtered.map((m, i) => {
                const idx = i + godCommands.length;
                return (
                  <button
                    key={m._id}
                    onMouseEnter={() => setMentionIndex(idx)}
                    onClick={() => insertMention(m)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors",
                      mentionIndex === idx ? "bg-accent" : "hover:bg-accent/60",
                    )}
                  >
                    <UserAvatar user={m} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-medium">{m.name ?? "Member"}</span>
                        {m.employeeId && (
                          <span className="shrink-0 rounded border border-primary/20 bg-primary/10 px-1 py-px font-mono text-[9px] font-semibold text-primary">
                            {m.employeeId}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {m.email ?? m.designation ?? ""}
                      </div>
                    </div>
                    {mentionIndex === idx && <CornerDownLeft className="size-3.5 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <EmojiPicker onPick={(e) => setText((t) => t + e)} />
        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => fileRef.current?.click()}
          title="Attach files"
        >
          <Paperclip className="size-[18px]" />
        </Button>
        <StickerButton onPick={(e) => setText((t) => (t + e).trimStart())} />
        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => setPollOpen(true)}
          title="Create poll"
        >
          <BarChart3 className="size-[18px]" />
        </Button>

        <Textarea
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            setText(v);
            analyzeText(v);
            onTyping(true);
            fireTyping();
          }}
          onPaste={(e) => {
            // Paste a screenshot / copied image straight into the chat (like
            // Google Chat / WhatsApp): grab image files from the clipboard and
            // upload them instead of dumping raw binary into the text box.
            let files: File[] = [];
            try {
              const items = e.clipboardData?.items ?? [];
              for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.kind === "file") {
                  const f = item.getAsFile();
                  if (f && f.type.startsWith("image/")) files.push(f);
                }
              }
            } catch {
              /* clipboard API unsupported */
            }
            if (files.length === 0 && e.clipboardData?.files) {
              files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
            }
            if (files.length > 0) {
              e.preventDefault();
              handleFiles(files);
            }
          }}
          onKeyDown={(e) => {
            if (mentionOpen && mentionListLength > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setMentionIndex((i) => (i + 1) % mentionListLength);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setMentionIndex((i) => (i - 1 + mentionListLength) % mentionListLength);
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                if (mentionIndex < godCommands.length) {
                  insertGodCommand(godCommands[mentionIndex].token);
                } else {
                  insertMention(filtered[mentionIndex - godCommands.length]);
                }
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                closePopovers();
                return;
              }
            }
            if (slashOpen) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSlashIndex((i) => (i + 1) % SLASH_COMMANDS.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSlashIndex((i) => (i - 1 + SLASH_COMMANDS.length) % SLASH_COMMANDS.length);
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                insertSlash(slashIndex);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setSlashOpen(false);
                return;
              }
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendText();
            }
          }}
          placeholder={
            editTarget
              ? "Edit message…"
              : "Message… @mention"
          }
          className="max-h-[72px] sm:max-h-32 min-h-10 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0"
          rows={1}
        />

        {text.trim() || editTarget ? (
          <Button
            size="icon"
            className="size-9 shrink-0 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => handleSendText()}
            disabled={sending || uploading !== null}
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        ) : recording ? (
          <Button
            size="icon"
            className="size-9 shrink-0 rounded-xl bg-rose-500 text-white hover:bg-rose-500"
            onClick={stopRecording}
          >
            <Square className="size-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            className="size-9 shrink-0 rounded-xl text-muted-foreground"
            variant="ghost"
            onClick={startRecording}
            title="Record voice message"
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />}
          </Button>
        )}
      </div>

      <PollDialog
        open={pollOpen}
        onOpenChange={setPollOpen}
        onSubmit={async (question, options) => {
          await createPoll({
            conversationId: conversationId as any,
            question,
            options,
          }).catch((e) => toast(e instanceof Error ? e.message : "Poll failed"));
          setPollOpen(false);
        }}
      />
    </div>
  );
}

function CornerUpRightIcon() {
  return <AudioLines className="size-4" />;
}

function StickerButton({ onPick }: { onPick: (e: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 text-muted-foreground hover:text-foreground"
          title="Stickers"
        >
          <Sticker className="size-[18px]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-64 p-3">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Stickers
        </div>
        <div className="grid grid-cols-6 gap-1">
          {STICKERS.map((s) => (
            <button
              key={s}
              onClick={() => onPick(s)}
              className="rounded-lg p-1.5 text-xl transition-transform hover:scale-125 hover:bg-accent"
            >
              {s}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PollDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (question: string, options: string[]) => void;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const busyRef = useRef(false);

  const submit = () => {
    const q = question.trim();
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!q || opts.length < 2 || busyRef.current) return;
    busyRef.current = true;
    onSubmit(q, opts);
    setQuestion("");
    setOptions(["", ""]);
    busyRef.current = false;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a poll</DialogTitle>
          <DialogDescription>Ask the conversation a question with up to 6 options.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Question…"
            className="h-10"
          />
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={o}
                onChange={(e) => setOptions((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                placeholder={`Option ${i + 1}`}
                className="h-9"
              />
              {options.length > 2 && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </div>
          ))}
          {options.length < 6 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setOptions((prev) => [...prev, ""])}
            >
              + Add option
            </Button>
          )}
        </div>
        <DialogFooter>
          <Button
            onClick={submit}
            disabled={!question.trim() || options.filter((o) => o.trim()).length < 2}
            className="bg-primary text-primary-foreground"
          >
            <BarChart3 className="size-4" /> Create poll
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
