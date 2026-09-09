import { Injectable } from "@nestjs/common";

@Injectable()
export class AiService {
  private get enabled(): boolean {
    return !!(process.env.AI_API_KEY || process.env.OPENAI_API_KEY);
  }

  private get baseUrl(): string {
    return process.env.AI_BASE_URL || "https://api.openai.com/v1";
  }

  private get model(): string {
    return process.env.AI_MODEL || "gpt-4o-mini";
  }

  private get apiKey(): string {
    return process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "";
  }

  async status() {
    return {
      enabled: this.enabled,
      provider: "openai-compatible",
      model: this.model,
    };
  }

  async chat(userId: string, body: { message: string; messages?: any[]; conversationId?: string; context?: string; system?: string }) {
    if (!this.enabled) {
      return {
        reply: "AI is not configured yet. Set AI_API_KEY / AI_BASE_URL / AI_MODEL in server.env to enable assistant features.",
      };
    }
    const messages: any[] = [{ role: "system", content: body.system || "You are SHINE assistant, a helpful enterprise messaging assistant. Keep replies concise and friendly." }];
    if (body.context) messages.push({ role: "user", content: body.context });
    if (Array.isArray(body.messages)) messages.push(...body.messages);
    messages.push({ role: "user", content: body.message });
    return this.complete(messages);
  }

  async summarize(messages: any[]) {
    const text = (messages || []).map((m) => `${m.name || m.userId || "user"}: ${m.text || m.content || ""}`).join("\n").slice(0, 8000);
    const reply = await this.complete([
      { role: "system", content: "Summarize the following conversation into 3-6 bullet points. Be concise and factual." },
      { role: "user", content: text || "(empty conversation)" },
    ]);
    return { summary: reply.reply.split("\n").filter(Boolean), reply: reply.reply };
  }

  async actionItems(messages: any[]) {
    const text = (messages || []).map((m) => `${m.name || m.userId || "user"}: ${m.text || m.content || ""}`).join("\n").slice(0, 8000);
    const reply = await this.complete([
      { role: "system", content: "Extract action items from this conversation. Return a JSON array of {task, assignee, due} objects. Assignee may be unknown." },
      { role: "user", content: text || "(empty conversation)" },
    ]);
    return { items: reply.reply, reply: reply.reply };
  }

  async generateReply(message: string, tone?: string) {
    const reply = await this.complete([
      { role: "system", content: `You are helping the user draft a reply. Tone: ${tone || "professional"}. Reply directly, no preamble.` },
      { role: "user", content: message },
    ]);
    return { reply: reply.reply };
  }

  async translate(text: string, targetLang: string) {
    const reply = await this.complete([
      { role: "system", content: `Translate the user's text into ${targetLang}. Output only the translation.` },
      { role: "user", content: text },
    ]);
    return { translatedText: reply.reply, reply: reply.reply };
  }

  async fixGrammar(text: string) {
    const reply = await this.complete([
      { role: "system", content: "Fix grammar, spelling, and punctuation. Return only the corrected text." },
      { role: "user", content: text },
    ]);
    return { fixedText: reply.reply, reply: reply.reply };
  }

  private async complete(messages: any[]) {
    if (!this.enabled) {
      return { reply: "AI not configured" };
    }
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ model: this.model, messages, temperature: 0.7 }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return { reply: `AI request failed (${res.status})`, error: errText.slice(0, 400) };
      }
      const data: any = await res.json();
      const reply = data?.choices?.[0]?.message?.content ?? "(empty response)";
      if (reply.startsWith("```json")) {
        return { reply, json: this.tryJson(reply) };
      }
      return { reply };
    } catch (e: any) {
      return { reply: "AI request failed", error: String(e?.message || e) };
    }
  }

  private tryJson(s: string) {
    try {
      const cleaned = s.replace(/^```json\s*/, "").replace(/```$/, "").trim();
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }
}