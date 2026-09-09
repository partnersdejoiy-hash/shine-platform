import { Injectable, Inject } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DB } from "../db/database.module";

@Injectable()
export class SearchService {
  constructor(@Inject(DB) private db: any) {}
  async globalSearch(userId: string, query: string) {
    const messagesResult = await this.db.execute(sql`
      SELECT m.id, m.body, m.created_at, c.name as context_name, 'message' as type
      FROM messages m INNER JOIN conversations c ON m.conversation_id = c.id
      INNER JOIN conversation_members cm ON c.id = cm.conversation_id AND cm.user_id = ${userId}
      WHERE m.body ILIKE ${`%${query}%`} AND m.deleted = false ORDER BY m.created_at DESC LIMIT 20`);
    const usersResult = await this.db.execute(sql`
      SELECT id, name, email, image, 'user' as type FROM users
      WHERE name ILIKE ${`%${query}%`} OR email ILIKE ${`%${query}%`} LIMIT 20`);
    return { messages: messagesResult.rows, users: usersResult.rows };
  }
}
