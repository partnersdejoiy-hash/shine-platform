import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { getCurrentUser, safeStorageUrl } from "./users";

/** Generate an upload URL for the client to PUT a file to Convex storage. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/** Persist metadata after the client uploaded the file. */
export const saveFile = mutation({
  args: {
    storageId: v.string(),
    url: v.optional(v.string()),
    name: v.string(),
    mimeType: v.string(),
    size: v.number(),
    conversationId: v.optional(v.id("conversations")),
    folderId: v.optional(v.id("folders")),
    kind: v.optional(v.string()),
  },
  handler: async (ctx, { storageId, url, name, mimeType, size, conversationId, folderId, kind }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    // Self-hosted uploads carry a ready-to-render URL; Convex keys are resolved
    // here (and again lazily in myFiles) so files always display.
    const resolved = (await safeStorageUrl(ctx, storageId, url)) ?? "";
    const id = await ctx.db.insert("files", {
      ownerId: me._id,
      conversationId,
      folderId,
      name,
      mimeType,
      size,
      storageId,
      url: resolved,
      kind,
      version: 1,
      createdAt: Date.now(),
    });
    return id;
  },
});

export const myFiles = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { files: [], folders: [], totalBytes: 0 };
    const files = await ctx.db
      .query("files")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .order("desc")
      .take(200);
    const folders = await ctx.db
      .query("folders")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    const withUrls = await Promise.all(
      files.map(async (f) => ({
        ...f,
        // Stored URL (self-hosted MinIO) wins; Convex keys resolved lazily.
        url: (await safeStorageUrl(ctx, f.storageId, f.url)) ?? "",
      })),
    );
    return {
      files: withUrls,
      folders,
      totalBytes: withUrls.reduce((sum, f) => sum + f.size, 0),
    };
  },
});

export const createFolder = mutation({
  args: { name: v.string(), parentId: v.optional(v.id("folders")) },
  handler: async (ctx, { name, parentId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    return await ctx.db.insert("folders", {
      ownerId: me._id,
      name: name.trim(),
      parentId,
      createdAt: Date.now(),
    });
  },
});

export const deleteFolder = mutation({
  args: { folderId: v.id("folders") },
  handler: async (ctx, { folderId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    const folder = await ctx.db.get(folderId);
    if (!folder || folder.ownerId !== me._id) throw new ConvexError("Not your folder");
    const children = await ctx.db
      .query("files")
      .withIndex("by_folder", (q) => q.eq("folderId", folderId))
      .collect();
    for (const f of children) {
      await ctx.storage.delete(f.storageId as any);
      await ctx.db.delete(f._id);
    }
    await ctx.db.delete(folderId);
  },
});

export const deleteFile = mutation({
  args: { fileId: v.id("files") },
  handler: async (ctx, { fileId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    const file = await ctx.db.get(fileId);
    if (!file || (file.ownerId !== me._id && !file.conversationId)) throw new ConvexError("Not your file");
    await ctx.storage.delete(file.storageId as any);
    await ctx.db.delete(fileId);
  },
});

export const renameFile = mutation({
  args: { fileId: v.id("files"), name: v.string() },
  handler: async (ctx, { fileId, name }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    const file = await ctx.db.get(fileId);
    if (!file || file.ownerId !== me._id) throw new ConvexError("Not your file");
    await ctx.db.patch(fileId, { name: name.trim() });
  },
});
