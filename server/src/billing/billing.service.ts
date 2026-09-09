import { Injectable, Inject, BadRequestException } from "@nestjs/common";
import { eq, desc } from "drizzle-orm";
import { DB } from "../db/database.module";
import { payments } from "../db/schema";
import { nanoid } from "nanoid";

const PLANS = [
  { code: "free", name: "Free", price: 0, currency: "INR", period: "month", features: ["Up to 10 users", "Unlimited chats", "10 GB storage"] },
  { code: "pro", name: "Pro", price: 199, currency: "INR", period: "month", features: ["Up to 100 users", "Meetings + recordings", "100 GB storage", "Priority support"] },
  { code: "business", name: "Business", price: 499, currency: "INR", period: "month", features: ["Unlimited users", "LiveKit video", "Unlimited storage", "SSO + audit logs"] },
];

@Injectable()
export class BillingService {
  constructor(@Inject(DB) private db: any) {}

  async getPlans() {
    return PLANS;
  }

  async createOrder(userId: string, body: { planCode: string }) {
    const plan = PLANS.find((p) => p.code === body.planCode);
    if (!plan) throw new BadRequestException("Unknown plan");
    const orderId = "ORD" + nanoid(8).toUpperCase();
    await this.db.insert(payments).values({
      userId, planCode: plan.code, planName: plan.name, amount: plan.price,
      currency: plan.currency, orderId, status: "created", createdAt: Date.now(),
    });
    return { orderId, amount: plan.price, currency: plan.currency, plan };
  }

  async verifyPayment(userId: string, body: { orderId: string; paymentId?: string; signature?: string }) {
    const [pay] = await this.db.select().from(payments)
      .where(eq(payments.orderId, body.orderId)).limit(1);
    if (!pay) throw new BadRequestException("Order not found");
    await this.db.update(payments).set({
      paymentId: body.paymentId, signature: body.signature, status: "paid",
    }).where(eq(payments.orderId, body.orderId));
    return { ok: true, status: "paid", planCode: pay.planCode };
  }

  async overview(userId: string) {
    const rows = await this.db.select().from(payments)
      .where(eq(payments.userId, userId)).orderBy(desc(payments.createdAt)).limit(50);
    const [total] = await this.db.execute(`SELECT coalesce(sum(amount),0)::int as total FROM payments WHERE user_id = $1 AND status = 'paid'`, [userId]);
    return {
      transactions: rows || [],
      lifetimeSpend: total?.total || 0,
      currentPlan: PLANS[0],
    };
  }
}