import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { eq, desc, sql } from "drizzle-orm";
import { DB } from "../db/database.module";
import { files as filesTable, folders } from "../db/schema";

@Injectable()
export class FilesService {
  constructor(@Inject(DB) private db: any) {}

  async upload(userId: string, data: { name: string; mimeType: string; size: number; storageId: string; url: string; kind?: string; conversationId?: string; folderId?: string }) {
    const [file] = await this.db.insert(filesTable).values({
      ...data, ownerId: userId, createdAt: Date.now(),
    }).returning();
    return file;
  }

  async list(userId: string, limit = 100, offset = 0) {
    return this.db.select().from(filesTable).where(eq(filesTable.ownerId, userId))
      .orderBy(desc(filesTable.createdAt)).limit(limit).offset(offset);
  }

  async listByConversation(conversationId: string) {
    return this.db.select().from(filesTable).where(eq(filesTable.conversationId, conversationId))
      .orderBy(desc(filesTable.createdAt));
  }

  async delete(fileId: string, userId: string) {
    return this.db.delete(filesTable).where(eq(filesTable.id, fileId));
  }

  async createFolder(userId: string, name: string, parentId?: string) {
    return this.db.insert(folders).values({ ownerId: userId, name, parentId, createdAt: Date.now() }).returning();
  }

  async listFolders(userId: string) {
    return this.db.select().from(folders).where(eq(folders.ownerId, userId));
  }

  async search(query: string, userId: string) {
    return this.db.execute(sql`SELECT * FROM files WHERE owner_id = ${userId} AND name ILIKE ${`%${query}%`} ORDER BY created_at DESC LIMIT 50`);
  }

  async rename(fileId: string, userId: string, name: string) {
    await this.db.update(filesTable).set({ name })
      .where(sql`id = ${fileId} AND owner_id = ${userId}`);
    return { ok: true };
  }

  async deleteFolder(folderId: string, userId: string) {
    const [folder] = await this.db.select().from(folders).where(eq(folders.id, folderId)).limit(1);
    if (!folder || folder.ownerId !== userId) throw new NotFoundException("Folder not found");
    await this.db.update(filesTable).set({ folderId: null })
      .where(sql`folder_id = ${folderId} AND owner_id = ${userId}`);
    await this.db.delete(folders).where(eq(folders.id, folderId));
    return { ok: true };
  }
}
