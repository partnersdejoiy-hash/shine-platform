import { action } from "./_generated/server";
import { v } from "convex/values";
import { askJoi } from "./joi";

const SHINE_AI_KEY = process.env.SHINE_AI_API_KEY;
const HAS_AI = () => JOI_ON || Boolean(SHINE_AI_KEY);
const SHINE_AI_BASE = process.env.SHINE_AI_BASE_URL ?? "https://api.openai.com/v1";
const SHINE_AI_MODEL = process.env.SHINE_AI_MODEL ?? "gpt-4o-mini";

// Joi is Shine's assistant: her brain on the Joi server answers when it's set up (JOI_API_URL + JOI_APP_SECRET)
const JOI_ON = Boolean(process.env.JOI_API_URL && process.env.JOI_APP_SECRET);

async function llm(messages: { role: "system" | "user" | "assistant"; content: string }[]) {
  if (JOI_ON) {
    const task = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    const turns = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
    const out = await askJoi(turns, task).catch(() => null);
    if (out) return out;
  }
  if (!SHINE_AI_KEY) return null;
  try {
    const res = await fetch(`${SHINE_AI_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SHINE_AI_KEY}`,
      },
      body: JSON.stringify({ model: SHINE_AI_MODEL, messages, temperature: 0.4 }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

/** Whether an LLM is configured (env var present on the deployment). */
export const status = action({
  args: {},
  handler: async () => ({
    configured: HAS_AI(),
    model: JOI_ON ? "Joi" : SHINE_AI_MODEL,
    provider: JOI_ON ? "Joi" : SHINE_AI_BASE.replace(/^https?:\/\//, "").replace(/\/v1$/, ""),
  }),
});

/** Summarize a conversation. Uses the LLM when a key is configured, otherwise a local heuristic. */
export const summarizeChat = action({
  args: { messages: v.array(v.string()) },
  handler: async (_, { messages }) => {
    if (messages.length === 0) {
      return { summary: "No messages to summarize yet.", source: "local" as const };
    }
    const transcript = messages.slice(-200).join("\n");
    if (HAS_AI()) {
      const out = await llm([
        {
          role: "system",
          content:
            "Summarize the chat transcript into 4-6 concise bullet points covering decisions, questions, and action items. Use the same language as the transcript.",
        },
        { role: "user", content: transcript },
      ]);
      if (out) return { summary: out, source: "llm" as const };
    }
    // Local heuristic summary: speakers, volume, topics
    const lines = messages.slice(-200);
    const speakers = new Map<string, number>();
    const words = new Map<string, number>();
    for (const line of lines) {
      const [speaker, ...rest] = line.split(":");
      const text = rest.join(":").trim();
      if (text) {
        speakers.set(speaker.trim(), (speakers.get(speaker.trim()) ?? 0) + 1);
        for (const w of text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)) {
          if (w.length > 3 && !["this", "that", "with", "from", "have", "they", "there", "your", "what", "about", "will", "when"].includes(w)) {
            words.set(w, (words.get(w) ?? 0) + 1);
          }
        }
      }
    }
    const topSpeakers = Array.from(speakers.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => `${name} (${count} messages)`)
      .join(", ");
    const topTopics = Array.from(words.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([w]) => w)
      .join(", ");
    return {
      summary: [
        `• ${lines.length} messages analyzed across ${speakers.size} participants.`,
        topSpeakers ? `• Most active: ${topSpeakers}.` : "• Single-participant thread.",
        topTopics ? `• Key topics: ${topTopics}.` : "• Mostly short messages.",
        "• Tip: connect an LLM API key (SHINE_AI_API_KEY) for deeper, language-aware summaries.",
      ].join("\n"),
      source: "local" as const,
    };
  },
});

/** Extract action items & tasks from a transcript. Local + LLM hybrid. */
export const extractActionItems = action({
  args: { messages: v.array(v.string()) },
  handler: async (_, { messages }) => {
    const transcript = messages.slice(-200).join("\n");
    if (HAS_AI()) {
      const out = await llm([
        {
          role: "system",
          content:
            "Extract action items from the transcript. Return a JSON array of objects {task, owner} (owner empty if unknown). Only return valid JSON, nothing else.",
        },
        { role: "user", content: transcript },
      ]);
      if (out) {
        try {
          const parsed = JSON.parse(out);
          if (Array.isArray(parsed)) {
            return {
              items: parsed
                .filter((i: any) => typeof i?.task === "string")
                .map((i: any) => ({ task: i.task, owner: i.owner ?? "" })),
              source: "llm" as const,
            };
          }
        } catch {
          /* fall through to local */
        }
      }
    }
    // Local: sentences with action verbs or explicit "I will / we should / please / TODO"
    const markers = /(i will|i'll|we should|we need|please|todo|to-do|remember to|make sure|follow up|send|review|schedule|update|prepare|finish|complete)/i;
    const items = messages
      .flatMap((line) => line.split(/(?<=[.!?])\s+/))
      .filter((s) => s.trim().length > 8 && markers.test(s))
      .slice(0, 10)
      .map((s) => ({ task: s.trim(), owner: "" }));
    return { items, source: "local" as const };
  },
});

/** Generate a reply draft. Requires an LLM key. */
export const generateReply = action({
  args: { context: v.string() },
  handler: async (_, { context }) => {
    if (!HAS_AI()) return { reply: null, reason: "Joi will answer here as soon as her server is connected." };
    const reply = await llm([
      {
        role: "system",
        content:
          "Write one concise, professional reply draft (2-3 sentences max) to the message thread. Match the tone of the thread.",
      },
      { role: "user", content: context },
    ]);
    return { reply, reason: null };
  },
});

/** Translate text. Requires an LLM key. */
export const translate = action({
  args: { text: v.string(), target: v.string() },
  handler: async (_, { text, target }) => {
    if (!HAS_AI()) return { translated: null, reason: "Joi will translate here as soon as her server is connected." };
    const translated = await llm([
      {
        role: "system",
        content: `You are a professional translator. Translate the user's text to ${target}. Return only the translation.`,
      },
      { role: "user", content: text },
    ]);
    return { translated, reason: null };
  },
});

/** Grammar correction. Requires an LLM key. */
export const fixGrammar = action({
  args: { text: v.string() },
  handler: async (_, { text }) => {
    if (!HAS_AI()) return { corrected: null, reason: "Joi will fix grammar here as soon as her server is connected." };
    const corrected = await llm([
      {
        role: "system",
        content: "Fix grammar and spelling in the text, keeping meaning and tone. Return only the corrected text.",
      },
      { role: "user", content: text },
    ]);
    return { corrected, reason: null };
  },
});
