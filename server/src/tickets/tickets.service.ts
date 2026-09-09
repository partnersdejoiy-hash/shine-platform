import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { eq, desc, sql, and } from "drizzle-orm";
import { DB } from "../db/database.module";
import { tickets } from "../db/schema";
import { nanoid } from "nanoid";

@Injectable()
export class TicketsService {
  constructor(@Inject(DB) private db: any) {}
  async create(userId: string, data: any) {
    const number = "DJT" + nanoid(5).toUpperCase();
    const now = Date.now();
    const [t] = await this.db.insert(tickets).values({
      ticketNumber: number, requesterId: userId, kind: data.kind, target: data.target,
      title: data.title, description: data.description, priority: data.priority || "normal",
      category: data.category, status: data.status || "pending",
      approverChain: data.approverChain || [], currentLevel: 0, notes: [],
      decisions: [], createdAt: now, updatedAt: now,
    }).returning();
    return t;
  }
  async list(userId: string, role: string) {
    if (role === "super_admin" || role === "admin") {
      return this.db.select().from(tickets).orderBy(desc(tickets.createdAt)).limit(200);
    }
    return this.db.select().from(tickets).where(eq(tickets.requesterId, userId)).orderBy(desc(tickets.createdAt)).limit(200);
  }
  async findById(id: string) {
    const [t] = await this.db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
    if (!t) throw new NotFoundException("Ticket not found");
    return t;
  }
  async updateStatus(id: string, status: string) {
    return this.db.update(tickets).set({ status: status as any, updatedAt: Date.now() }).where(eq(tickets.id, id)).returning();
  }
  async addNote(id: string, authorId: string, text: string) {
    const [t] = await this.db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
    const notes = [...(t.notes as any[] || []), { authorId, text, at: Date.now() }];
    return this.db.update(tickets).set({ notes, updatedAt: Date.now() }).where(eq(tickets.id, id)).returning();
  }
  async decide(id: string, approverId: string, action: string, comment?: string) {
    const [t] = await this.db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
    const decisions = [...(t.decisions as any[] || []), { approverId, action, comment, at: Date.now() }];
    const newStatus = action === "approved" ? "approved" : action === "rejected" ? "rejected" : t.status;
    return this.db.update(tickets).set({ decisions, status: newStatus as any, updatedAt: Date.now() }).where(eq(tickets.id, id)).returning();
  }
  async count() {
    const [r] = await this.db.execute(sql`SELECT count(*)::int as count FROM tickets`);
    return r?.count || 0;
  }

  // ── Agent-facing helpers ────────────────────────────────────────────
  async myTickets(userId: string) {
    return this.db.select().from(tickets).where(eq(tickets.requesterId, userId))
      .orderBy(desc(tickets.createdAt)).limit(200);
  }

  async approvalQueue() {
    return this.db.select().from(tickets)
      .where(sql`status = 'pending'`)
      .orderBy(desc(tickets.createdAt)).limit(200);
  }

  async cancelTicket(id: string, userId: string) {
    const [t] = await this.db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
    if (!t || t.requesterId !== userId) throw new NotFoundException("Ticket not found");
    return this.db.update(tickets).set({ status: "cancelled" as any, updatedAt: Date.now() })
      .where(eq(tickets.id, id)).returning();
  }

  async pickupTicket(id: string, agentId: string) {
    const [t] = await this.db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
    if (!t) throw new NotFoundException("Ticket not found");
    const notes = [...(t.notes as any[] || []), { authorId: agentId, text: "Ticket picked up", at: Date.now() }];
    return this.db.update(tickets).set({ pickedUpBy: agentId, pickedUpAt: Date.now(), notes, updatedAt: Date.now() })
      .where(eq(tickets.id, id)).returning();
  }

  async deleteTicket(id: string) {
    await this.db.delete(tickets).where(eq(tickets.id, id));
    return { ok: true };
  }
}
