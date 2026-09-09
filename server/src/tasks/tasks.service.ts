import { Injectable, Inject } from "@nestjs/common";
import { eq, and, desc, sql } from "drizzle-orm";
import { DB } from "../db/database.module";
import { tasks } from "../db/schema";

@Injectable()
export class TasksService {
  constructor(@Inject(DB) private db: any) {}
  async create(userId: string, data: any) {
    const [task] = await this.db.insert(tasks).values({ ...data, createdBy: userId, createdAt: Date.now() }).returning();
    return task;
  }
  async list(orgId: string) {
    return this.db.select().from(tasks).where(eq(tasks.orgId, orgId)).orderBy(desc(tasks.createdAt)).limit(200);
  }
  async update(taskId: string, data: any) {
    return this.db.update(tasks).set(data).where(eq(tasks.id, taskId)).returning();
  }
  async delete(taskId: string) {
    return this.db.delete(tasks).where(eq(tasks.id, taskId));
  }
}
