import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { presenceStatusValidator, availabilityValidator } from "./schema";
import { beat, choiceValidator, setOwn } from "./presence";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.users.currentUser);
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null) return null;
    return user;
  },
});

/** Internal helper: current user or null. */
export const getCurrentUser = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  return await ctx.db.get(userId);
};

/**
 * Which auth methods are actually configured (read from process.env, which is
 * populated from the project's Keys tab). Lets the login page enable/disable
 * buttons based on real provider state instead of failing on click.
 */
export const authProviderStatus = query({
  args: {},
  handler: async () => {
    const has = (k: string) => !!(process.env[k] ?? "").trim();
    return {
      email: true, // email OTP always available (Freebuff OTP relay)
      anonymous: false, // guest login removed — every account is a real employee
      google: has("AUTH_GOOGLE_ID") && has("AUTH_GOOGLE_SECRET"),
      github: has("AUTH_GITHUB_ID") && has("AUTH_GITHUB_SECRET"),
      microsoft: has("AUTH_MICROSOFT_ENTRA_ID_ID") && has("AUTH_MICROSOFT_ENTRA_ID_SECRET"),
      apple: has("AUTH_APPLE_ID") && has("AUTH_APPLE_SECRET"),
      secret: has("AUTH_SECRET") || has("BETTER_AUTH_SECRET"),
    };
  },
});

/** Directory of all users (company directory / search). */
/** People you can see: your own company (same mail domain); the Dejoiy team sees everyone. */
export function sameCompany(me: { email?: string | null; role?: string | null }, u: { email?: string | null }) {
  if (me.role === "super_admin" || me.role === "dejoiy_admin") return true;
  const domain = (e?: string | null) => (e ?? "").toLowerCase().split("@")[1] ?? "";
  return !!domain(me.email) && domain(me.email) === domain(u.email);
}

export const directory = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const me = await ctx.db.get(userId);
    if (!me) return [];
    const users = await ctx.db.query("users").collect();
    return users.filter((u) => u._id === me._id || (u.isActive !== false && sameCompany(me, u)));
  },
});

/**
 * Resolve a storage URL safely. Self-hosted (MinIO-style) keys contain "/"
 * and are NOT Convex storage ids — calling storage.getUrl with one THROWS,
 * which would crash whole queries. Prefer the URL stored with the upload.
 */
export async function safeStorageUrl(
  ctx: { storage: any },
  storageId?: string | null,
  fallbackUrl?: string | null,
): Promise<string | undefined> {
  if (fallbackUrl) return fallbackUrl;
  if (!storageId || storageId.includes("/")) return fallbackUrl ?? undefined;
  try {
    return (await ctx.storage.getUrl(storageId)) ?? fallbackUrl ?? undefined;
  } catch {
    return fallbackUrl ?? undefined;
  }
}

/**
 * Search ANY user of the app for @mention suggestions (not just conversation
 * members). Admins can mention anyone; every user can reach any active
 * account — mentioned non-members are auto-joined to the conversation so the
 * mention actually lands (see messages.send).
 *
 * People can also be found by their dedicated SHINE employee ID (DSU001 …).
 */
export const mentionSearch = query({
  args: { query: v.optional(v.string()) },
  handler: async (ctx, { query }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const me = await ctx.db.get(userId);
    if (!me) return [];
    const q = (query ?? "").toLowerCase().trim();
    const users = await ctx.db.query("users").collect();
    return users
      .filter(
        (u) =>
          String(u._id) !== String(userId) &&
          u.isActive !== false &&
          sameCompany(me, u) &&
          (!q ||
            (u.name ?? "").toLowerCase().includes(q) ||
            (u.email ?? "").toLowerCase().includes(q) ||
            (u.employeeId ?? "").toLowerCase().includes(q)),
      )
      .slice(0, 20)
      .map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        image: u.image,
        designation: u.designation,
        role: u.role,
        company: u.company,
        employeeId: u.employeeId,
      }));
  },
});

// ---- Dedicated employee IDs (DSU001, DDA002, DEM017 …) ---------------------
// Every user gets a permanent SHINE ID derived from their role:
//   super_admin → DSU · dejoiy_admin → DDA · admin → DAD · super_it → DSI
//   it → DIT · president → DPR · director → DDI · om → DOM · tl → DTL
//   client_admin → DCA · user (Employee) → DEM · member → DMB
// The three-digit sequence is unique per prefix and never re-used.

export const EMPLOYEE_ID_PREFIX: Record<string, string> = {
  super_admin: "DSU",
  dejoiy_admin: "DDA",
  admin: "DAD",
  super_it: "DSI",
  it: "DIT",
  president: "DPR",
  director: "DDI",
  om: "DOM",
  tl: "DTL",
  client_admin: "DCA",
  user: "DEM",
  member: "DMB",
};

export function employeeIdForRole(role?: string | null): string | null {
  return role ? (EMPLOYEE_ID_PREFIX[role] ?? null) : null;
}

/**
 * Make sure the user has a dedicated employee ID matching their current role.
 * Idempotent: existing IDs are kept unless they belong to a different role
 * prefix (which happens when a user is promoted/demoted). Returns the ID.
 */
export async function ensureEmployeeId(
  ctx: { db: any },
  userId: string,
): Promise<string | undefined> {
  const user = await ctx.db.get(userId);
  if (!user) return undefined;
  const prefix = employeeIdForRole(user.role);
  if (!prefix) return user.employeeId ?? undefined;
  if (user.employeeId && user.employeeId.startsWith(prefix)) {
    return user.employeeId as string;
  }
  // Find the highest existing sequence for this prefix, then take the next.
  const all = await ctx.db.query("users").take(2000);
  let maxSeq = 0;
  for (const u of all) {
    const id: string | undefined = u.employeeId;
    if (id && id.startsWith(prefix)) {
      const n = parseInt(id.slice(prefix.length), 10);
      if (!Number.isNaN(n)) maxSeq = Math.max(maxSeq, n);
    }
  }
  const seq = String(maxSeq + 1).padStart(3, "0");
  const employeeId = `${prefix}${seq}`;
  await ctx.db.patch(userId, { employeeId });
  return employeeId;
}

export const getUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db.get(userId);
  },
});

/** All presence rows (for the whole directory). */
export const presenceAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("presence").collect();
  },
});

/** Update the user's profile. Only provided fields are patched. */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    coverImage: v.optional(v.string()),
    bio: v.optional(v.string()),
    department: v.optional(v.string()),
    designation: v.optional(v.string()),
    company: v.optional(v.string()),
    location: v.optional(v.string()),
    timezone: v.optional(v.string()),
    employeeId: v.optional(v.string()),
    phone: v.optional(v.string()),
    skills: v.optional(v.array(v.string())),
    availability: v.optional(availabilityValidator),
    customStatus: v.optional(v.string()),
  },
  handler: async (ctx, patch) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, val]) => val !== undefined),
    );
    if (Object.keys(clean).length > 0) {
      await ctx.db.patch(userId, clean);
    }
    return await ctx.db.get(userId);
  },
});

/** Set the user's app accent color (persists per-user, all roles). */
export const setAccentColor = mutation({
  args: { accentColor: v.string() },
  handler: async (ctx, { accentColor }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    if (!/^[a-z0-9-]{1,32}$/.test(accentColor)) {
      throw new Error("Invalid accent color");
    }
    await ctx.db.patch(userId, { accentColor });
    await logAudit(ctx, userId, "user.accent_changed", "users", String(userId), accentColor);
    return true;
  },
});

export const setNotificationPrefs = mutation({
  args: {
    prefs: v.object({
      mentions: v.boolean(),
      directMessages: v.boolean(),
      groupMessages: v.boolean(),
      calls: v.boolean(),
      meetings: v.boolean(),
      announcements: v.boolean(),
      sound: v.boolean(),
      desktop: v.boolean(),
    }),
  },
  handler: async (ctx, { prefs }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    await ctx.db.patch(userId, { notificationPrefs: prefs });
  },
});

/** Per-event notification sounds ("off" | builtin id | "custom") + optional custom sound. */
export const setSoundPrefs = mutation({
  args: {
    soundPrefs: v.optional(v.record(v.string(), v.string())),
    customSoundUrl: v.optional(v.string()),
    customSoundStorageId: v.optional(v.string()),
  },
  handler: async (ctx, { soundPrefs, customSoundUrl, customSoundStorageId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const patch: Record<string, unknown> = {};
    if (soundPrefs) patch.soundPrefs = soundPrefs;
    if (customSoundUrl !== undefined) patch.customSoundUrl = customSoundUrl;
    if (customSoundStorageId !== undefined) patch.customSoundStorageId = customSoundStorageId;
    await ctx.db.patch(userId, patch as any);
    return true;
  },
});

/** Presence heartbeat. Call this every ~30s while the app is open; idle = no input for a while (shows Away). */
export const heartbeat = mutation({
  args: {
    // older apps still send a status; it only matters for picking busy/away/invisible by hand
    status: v.optional(presenceStatusValidator),
    customStatus: v.optional(v.string()),
    idle: v.optional(v.boolean()),
  },
  handler: async (ctx, { status, idle }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return;
    let me = await ctx.db.get(userId);
    if (!me) return;
    if (idle === undefined && status && status !== "online" && status !== "offline" && !me.presenceChoice) {
      await ctx.db.patch(userId, { presenceChoice: status === "away" ? "away" : status === "busy" ? "busy" : "invisible" });
      me = (await ctx.db.get(userId))!;
    }
    await beat(ctx, me, idle ?? false);
    // Lazy-assign a dedicated employee ID to any signed-in user who lacks one
    // (cheap, idempotent — the ID only changes when the role prefix changes).
    if (!me.employeeId) {
      await ensureEmployeeId(ctx, userId);
    }
  },
});

/** Pick how you show up: Automatic (Active / Away when idle), Away, Do not disturb, or Appear offline. */
export const setPresence = mutation({
  args: { choice: choiceValidator },
  handler: async (ctx, { choice }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    return await setOwn(ctx, userId, { choice });
  },
});

/** Your written status (like WhatsApp's), shown to colleagues in Shine and Dejoiy Mail. Empty clears it. */
export const setStatusText = mutation({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    return await setOwn(ctx, userId, { text });
  },
});

export const goOffline = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return;
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "offline",
        updatedAt: Date.now(),
      });
    }
    await ctx.db.patch(userId, { lastSeen: Date.now() });
  },
});

/**
 * Auto-add every @dejoiy.com user to the DEJOIY organization on sign-in.
 * Called from the app shell for every signed-in user. Idempotent.
 */
export const bootstrapDejoiyMembership = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return;
    const me = await ctx.db.get(userId);
    if (!me) return;

    // Only for @dejoiy.com users
    const email = (me.email ?? "").toLowerCase().trim();
    if (!email.endsWith("@dejoiy.com")) return;

    // Find the DEJOIY org
    const dejoiy = await ctx.db
      .query("organizations")
      .withIndex("by_name", (q) => q.eq("name", "DEJOIY"))
      .first();
    if (!dejoiy) return; // org not created yet (super admin bootstrap will create it)

    // Already a member?
    const existing = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org", (q) => q.eq("orgId", dejoiy._id))
      .filter((q) => q.eq(q.field("userId"), userId))
      .unique();
    if (existing) return; // already a member

    const now = Date.now();
    await ctx.db.insert("organizationMembers", {
      orgId: dejoiy._id,
      userId,
      role: "member",
      joinedAt: now,
    });

    // Also update the user's company field
    if (!me.company) {
      await ctx.db.patch(userId, { company: "DEJOIY" });
    }

    await logAudit(
      ctx,
      userId,
      "user.auto_joined_dejoiy",
      "organizations",
      String(dejoiy._id),
      `${email} auto-joined DEJOIY org`,
    );
  },
});

// The permanent SHINE super admin account. This identity is provisioned and
// protected automatically — it can never be demoted or deactivated by other
// admins (see src/convex/admin.ts).
export const SUPER_ADMIN_EMAIL = "deepak.sharma@corp.dejoiy.com";

export function isSuperAdminEmail(email?: string | null): boolean {
  return (email ?? "").toLowerCase().trim() === SUPER_ADMIN_EMAIL;
}

export function isSuperAdmin(user: { email?: string | null; role?: string | null } | null | undefined): boolean {
  return !!user && (user.role === "super_admin" || isSuperAdminEmail(user.email));
}


/**
 * Bootstrap the permanent super admin + the DEJOIY company.
 * Called on every app shell mount for the signed-in user. Idempotent.
 *
 * When deepak.sharma@corp.dejoiy.com signs in, they are locked in as Super Admin,
 * CEO of DEJOIY, and owner of the DEJOIY organization (created on first run).
 */
export const bootstrapSuperAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return;
    const me = await ctx.db.get(userId);
    if (!me) return;

    if (!isSuperAdminEmail(me.email)) return;

    // Lock in identity + profile as the DEJOIY CEO.
    await ctx.db.patch(userId, {
      role: "super_admin",
      company: "DEJOIY",
      designation: "CEO",
      isActive: true,
    });
    // The super admin owns ID DSU001 — the very first SHINE ID.
    await ensureEmployeeId(ctx, userId);

    // Ensure the DEJOIY organization exists, owned by the super admin.
    const now = Date.now();
    let dejoiy = await ctx.db
      .query("organizations")
      .withIndex("by_name", (q) => q.eq("name", "DEJOIY"))
      .first();
    if (!dejoiy) {
      const orgId = await ctx.db.insert("organizations", {
        name: "DEJOIY",
        slug: "dejoiy",
        description: "The DEJOIY company — home of SHINE enterprise communication.",
        ownerId: userId,
        plan: "enterprise",
        createdAt: now,
      });
      dejoiy = await ctx.db.get(orgId);
    }
    if (!dejoiy) return;

    // Ensure ownership membership.
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org", (q) => q.eq("orgId", dejoiy._id))
      .filter((q) => q.eq(q.field("userId"), userId))
      .unique();
    if (!membership) {
      await ctx.db.insert("organizationMembers", {
        orgId: dejoiy._id,
        userId,
        role: "owner",
        department: "Executive",
        designation: "CEO",
        joinedAt: now,
      });
      await logAudit(ctx, userId, "user.super_admin_bootstrap", "organizations", String(dejoiy._id), "DEJOIY owner provisioned");
    }
  },
});

/** Upload a profile picture. Pass the storageId (and optional ready URL for
 *  self-hosted uploads) returned by the client upload. */
export const updateAvatar = mutation({
  args: { storageId: v.string(), url: v.optional(v.string()) },
  handler: async (ctx, { storageId, url }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("Not authenticated");
    // Free the previous avatar from storage (no orphans).
    const oldStorageId = me.avatarStorageId;
    const resolved = (await safeStorageUrl(ctx, storageId, url ?? undefined)) ?? "";
    if (!resolved) throw new Error("Could not resolve uploaded image");
    await ctx.db.patch(userId, { image: resolved, avatarStorageId: storageId });
    if (oldStorageId && oldStorageId !== storageId) {
      try {
        await ctx.storage.delete(oldStorageId as any);
      } catch {
        /* old file may already be gone */
      }
    }
    await logAudit(ctx, userId, "user.avatar_updated", "users", String(userId));
    return resolved;
  },
});

/** Remove the profile picture and fall back to the initials avatar. */
export const removeAvatar = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("Not authenticated");
    const oldStorageId = me.avatarStorageId;
    // Convex ignores `undefined` in patches, so use an empty-string sentinel
    // (all render paths already treat a falsy image as "no photo").
    await ctx.db.patch(userId, { image: "", avatarStorageId: "" });
    if (oldStorageId) {
      try {
        await ctx.storage.delete(oldStorageId as any);
      } catch {
        /* ignore */
      }
    }
    await logAudit(ctx, userId, "user.avatar_removed", "users", String(userId));
  },
});

/** Bootstrap: promote the very first registered user to admin. */
// ---- Devices & sessions -----------------------------------------------------

export const registerDevice = mutation({
  args: {
    name: v.string(),
    platform: v.optional(v.string()),
    isCurrent: v.optional(v.boolean()),
  },
  handler: async (ctx, { name, platform, isCurrent }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("devices")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    // dedupe by name+platform
    const dup = existing.find((d) => d.name === name && d.platform === platform);
    const now = Date.now();
    if (dup) {
      await ctx.db.patch(dup._id, { lastActiveAt: now, isCurrent });
      return dup._id;
    }
    const id = await ctx.db.insert("devices", {
      userId,
      name,
      platform,
      isTrusted: existing.length === 0,
      isCurrent,
      lastActiveAt: now,
      createdAt: now,
    });
    await logAudit(ctx, userId, "device.registered", "device", String(id), name);
    return id;
  },
});

export const myDevices = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("devices")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const setDeviceTrusted = mutation({
  args: { deviceId: v.id("devices"), trusted: v.boolean() },
  handler: async (ctx, { deviceId, trusted }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const device = await ctx.db.get(deviceId);
    if (!device || device.userId !== userId) throw new Error("Not your device");
    await ctx.db.patch(deviceId, { isTrusted: trusted });
    await logAudit(ctx, userId, "device.trust", "devices", String(deviceId), String(trusted));
  },
});

export const removeDevice = mutation({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, { deviceId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const device = await ctx.db.get(deviceId);
    if (!device || device.userId !== userId) throw new Error("Not your device");
    await ctx.db.delete(deviceId);
    await logAudit(ctx, userId, "device.revoked", "devices", String(deviceId), device.name);
  },
});

// ---- Audit helper -----------------------------------------------------------

export async function logAudit(
  ctx: { db: any },
  actorId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  details?: string,
  orgId?: string,
) {
  await ctx.db.insert("auditLogs", {
    orgId: orgId ?? undefined,
    actorId,
    action,
    targetType,
    targetId,
    details,
    createdAt: Date.now(),
  });
}
