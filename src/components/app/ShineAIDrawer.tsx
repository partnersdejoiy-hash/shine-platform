import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { displayName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  ClipboardList,
  Languages,
  Loader2,
  MessageSquarePlus,
  PenLine,
  Search,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { JOI_AVATAR } from "@/lib/joi";
import { toast } from "sonner";

type ChatItem = { role: "user" | "ai"; content: string; kind?: string };

export function ShineAIDrawer({
  open,
  onOpenChange,
  conversationId,
  onChatWithJoi,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId?: string | null;
  onChatWithJoi: () => void;
}) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [extracted, setExtracted] = useState<{ task: string; owner: string }[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const runStatus = useAction(api.ai.status);
  const summarize = useAction(api.ai.summarizeChat);
  const extract = useAction(api.ai.extractActionItems);
  const reply = useAction(api.ai.generateReply);
  const translate = useAction(api.ai.translate);
  const fixGrammar = useAction(api.ai.fixGrammar);
  const [status, setStatus] = useState<{ configured: boolean; model: string; provider: string } | null>(null);

  useEffect(() => {
    if (open && !status) {
      runStatus().then(setStatus).catch(() => {});
    }
  }, [open, status, runStatus]);

  const messages = useQuery(
    api.messages.list,
    conversationId ? { conversationId: conversationId as any } : "skip",
  );
  const createTask = useMutation(api.tasks.create);

  const transcript = (messages?.messages ?? [])
    .filter((m) => !m.deleted && m.body)
    .slice(-120)
    .map((m) => `${m.sender ? displayName(m.sender) : "Unknown"}: ${m.body}`);

  useEffect(() => {
    if (open) {
      setItems([
        {
          role: "ai",
          content:
            "Hiii, I'm Joi 👋 I can summarize this chat, pull out action items, draft a reply, fix grammar or translate. Want a proper chat? Tap “Chat with Joi”.",
        },
      ]);
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [items, extracted, busy]);

  const push = (item: ChatItem) => setItems((prev) => [...prev, item]);

  const run = async (label: string, fn: () => Promise<string>, kind?: string) => {
    setBusy(true);
    push({ role: "user", content: label });
    try {
      const out = await fn();
      push({ role: "ai", content: out, kind });
    } catch (e) {
      push({
        role: "ai",
        content: `Something went wrong: ${e instanceof Error ? e.message : "unknown error"}`,
      });
    } finally {
      setBusy(false);
    }
  };

  const actions: { icon: React.ElementType; label: string; desc: string; run: () => void }[] = [
    {
      icon: Sparkles,
      label: "Summarize chat",
      desc: "Key points from the last 120 messages",
      run: () =>
        run("Summarize this chat", async () => {
          const res = await summarize({ messages: transcript });
          if (res.source === "local") {
            return res.summary + "\n\n(Quick summary. Joi writes a proper one as soon as her server is connected.)";
          }
          return res.summary;
        }),
    },
    {
      icon: ClipboardList,
      label: "Extract action items",
      desc: "Tasks & owners from the conversation",
      run: () =>
        run("Extract action items", async () => {
          const res = await extract({ messages: transcript });
          if (res.items.length === 0) return "No clear action items found in recent messages.";
          setExtracted(res.items);
          return `Found ${res.items.length} action item${res.items.length > 1 ? "s" : ""}:`;
        }),
    },
    {
      icon: MessageSquarePlus,
      label: "Draft a reply",
      desc: "AI-written response to the thread",
      run: () =>
        run("Draft a reply", async () => {
          const res = await reply({ context: transcript.slice(-12).join("\n") });
          return res.reply ?? `_${res.reason}_`;
        }),
    },
    {
      icon: PenLine,
      label: "Fix grammar",
      desc: "Correct the draft below",
      run: () => {
        const text = input.trim();
        if (!text) {
          toast("Type a draft in the input box first");
          return;
        }
        run(`Fix grammar: "${text.slice(0, 60)}${text.length > 60 ? "…" : ""}"`, async () => {
          const res = await fixGrammar({ text });
          return res.corrected ?? `_${res.reason}_`;
        });
      },
    },
    {
      icon: Languages,
      label: "Translate",
      desc: "Translate the input to French",
      run: () => {
        const text = input.trim();
        if (!text) {
          toast("Type text in the input box first");
          return;
        }
        run(`Translate to French: "${text.slice(0, 60)}${text.length > 60 ? "…" : ""}"`, async () => {
          const res = await translate({ text, target: "French" });
          return res.translated ?? `_${res.reason}_`;
        });
      },
    },
    {
      icon: Search,
      label: "Smart search",
      desc: "Find context across the workspace",
      run: () => {
        push({ role: "user", content: "Smart search" });
        push({
          role: "ai",
          content:
            "Use Cmd+K to search messages, people, files, meetings, channels and organizations across the entire workspace. The palette runs a live full-text search over everything you have access to.",
        });
      },
    },
  ];

  const sendPrompt = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    await run(`Prompt: ${text.slice(0, 80)}`, async () => {
      const res = await reply({ context: `${transcript.slice(-10).join("\n")}\n\nUser prompt: ${text}` });
      return res.reply ?? `_${res.reason}_`;
    });
  };

  const createTasksFromExtracted = async () => {
    if (!extracted || !conversationId) return;
    // find the conversation's org (first org member) — fallback: no org
    toast(`Creating ${extracted.length} task(s) — requires an organization. Open Organizations to create one.`);
    setExtracted(null);
  };

  return (
    <>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] bg-black/40"
          onClick={() => onOpenChange(false)}
        />
      )}
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: open ? 0 : "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        className="glass-strong hairline fixed inset-y-0 right-0 z-[85] flex w-full max-w-md flex-col shadow-2xl"
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <img src={JOI_AVATAR} alt="" className="size-11 rounded-full border-2 border-[var(--sticker-border)] bg-primary object-cover" />
            <div>
              <div className="flex items-center gap-2 text-[15px] font-extrabold">
                Joi
                {status?.configured ? (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    <CheckCircle2 className="size-3" /> Connected
                  </span>
                ) : (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-foreground">Getting ready</span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">DEJOIY's AI buddy · tools for this chat</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" onClick={onChatWithJoi}>
              Chat with Joi
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Close">
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* conversation */}
        <div className="flex items-center justify-between px-5 py-3 text-xs">
          <span className="text-muted-foreground">
            {conversationId ? "Context: current conversation" : "Context: workspace"}
          </span>
          <span className="rounded-full bg-accent px-2 py-0.5 text-muted-foreground">
            {transcript.length} messages
          </span>
        </div>

        {/* quick actions */}
        <div className="grid grid-cols-2 gap-2 px-5 pb-4">
          {actions.map((a) => (
            <button
              key={a.label}
              disabled={busy}
              onClick={a.run}
              className="group flex items-start gap-2.5 rounded-xl border border-border/80 bg-card p-3 text-left transition-all hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
            >
              <a.icon className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                <span className="block text-xs font-semibold">{a.label}</span>
                <span className="mt-0.5 block text-[10px] leading-4 text-muted-foreground">{a.desc}</span>
              </span>
            </button>
          ))}
        </div>

        {/* chat */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 pb-4">
          {items.map((it, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[92%] rounded-2xl p-3 text-sm leading-6",
                it.role === "user"
                  ? "ml-auto rounded-br-sm bg-primary/15 text-foreground"
                  : "bubble-in rounded-bl-sm",
              )}
            >
              <pre className="whitespace-pre-wrap font-sans">{it.content}</pre>
            </div>
          ))}
          {extracted && (
            <div className="space-y-2 rounded-2xl border border-primary/25 bg-primary/5 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <Wand2 className="size-3.5" /> Action items
              </div>
              {extracted.map((e, i) => (
                <div key={i} className="rounded-lg bg-card p-2 text-xs">
                  <div className="font-medium">{e.task}</div>
                  {e.owner && <div className="text-muted-foreground">Owner: {e.owner}</div>}
                </div>
              ))}
              <Button size="sm" className="w-full text-xs" onClick={createTasksFromExtracted}>
                Create tasks in an organization
              </Button>
            </div>
          )}
          {busy && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin text-primary" /> Joi is thinking…
            </div>
          )}
        </div>

        {/* input */}
        <div className="border-t border-border p-4">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Joi about this chat…"
              className="min-h-11 max-h-32 flex-1 resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendPrompt();
                }
              }}
            />
            <Button
              size="icon"
              className="shrink-0 bg-primary text-primary-foreground"
              onClick={sendPrompt}
              disabled={busy || !input.trim()}
            >
              {busy ? <Spinner className="size-4" /> : <Sparkles className="size-4" />}
            </Button>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            Joi is an AI. It can make mistakes.
          </p>
        </div>
      </motion.aside>
    </>
  );
}
