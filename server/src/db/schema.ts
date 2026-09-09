import {
  pgTable, uuid, varchar, text, boolean, integer, bigint,
  timestamp, jsonb, index, uniqueIndex, pgEnum,
} from "drizzle-orm/pg-core";

// ── Enums ──────────────────────────────────────────────────────────────
export const roleEnum = pgEnum("role", [
  "super_admin", "dejoiy_admin", "admin", "super_it", "it",
  "president", "director", "om", "tl", "client_admin", "user", "member",
]);

export const presenceStatusEnum = pgEnum("presence_status", [
  "online", "away", "busy", "invisible", "offline",
]);

export const availabilityEnum = pgEnum("availability", [
  "available", "meeting", "focus", "do_not_disturb", "offline",
]);

export const conversationKindEnum = pgEnum("conversation_kind", ["chat", "channel"]);
export const chatTypeEnum = pgEnum("chat_type", ["direct", "group"]);
export const channelKindEnum = pgEnum("channel_kind", ["channel", "broadcast", "announcement"]);

export const messageKindEnum = pgEnum("message_kind", ["text", "file", "voice", "poll", "system"]);
export const memberRoleEnum = pgEnum("member_role", ["owner", "admin", "member"]);
export const teamMemberRoleEnum = pgEnum("team_member_role", ["lead", "member"]);

export const meetingStatusEnum = pgEnum("meeting_status", ["scheduled", "live", "ended", "cancelled"]);
export const meetingParticipantRoleEnum = pgEnum("meeting_participant_role", ["host", "moderator", "participant"]);
export const meetingParticipantStatusEnum = pgEnum("meeting_participant_status", ["active", "waiting", "denied"]);
export const meetingKindEnum = pgEnum("meeting_kind", ["meeting", "webinar", "breakout"]);

export const callKindEnum = pgEnum("call_kind", ["audio", "video"]);
export const callStatusEnum = pgEnum("call_status", ["ringing", "active", "ended", "declined", "missed"]);
export const signalKindEnum = pgEnum("signal_kind", ["offer", "answer", "ice"]);

export const permissionValueEnum = pgEnum("permission_value", ["true", "false", "limited", "team", "department"]);

export const ticketKindEnum = pgEnum("ticket_kind", ["permission", "role", "general", "password", "support", "org_update"]);
export const ticketStatusEnum = pgEnum("ticket_status", [
  "pending", "in_progress", "approved", "rejected", "resolved", "cancelled",
  "new", "open", "assigned", "waiting_for_user", "waiting_for_approval", "escalated", "reopened",
]);
export const ticketPriorityEnum = pgEnum("ticket_priority", ["low", "normal", "high", "urgent", "critical"]);

export const policyStatusEnum = pgEnum("policy_status", ["draft", "review", "approved", "published", "superseded", "archived"]);
export const orgMemberRoleEnum = pgEnum("org_member_role", ["owner", "admin", "member"]);

export const taskStatusEnum = pgEnum("task_status", ["todo", "in_progress", "done"]);
export const taskPriorityEnum = pgEnum("task_priority", ["low", "medium", "high", "urgent"]);

export const paymentStatusEnum = pgEnum("payment_status", ["created", "paid", "failed", "refunded"]);

export const requestStatusEnum = pgEnum("request_status", ["pending", "approved", "rejected"]);

// ── Users ──────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  image: text("image"),
  avatarStorageId: varchar("avatar_storage_id", { length: 255 }),
  role: roleEnum("role").default("member"),
  bio: text("bio"),
  coverImage: text("cover_image"),
  department: varchar("department", { length: 255 }),
  designation: varchar("designation", { length: 255 }),
  company: varchar("company", { length: 255 }),
  location: varchar("location", { length: 255 }),
  timezone: varchar("timezone", { length: 100 }),
  employeeId: varchar("employee_id", { length: 100 }),
  skills: jsonb("skills").$type<string[]>().default([]),
  socialLinks: jsonb("social_links").$type<{ platform: string; url: string }[]>().default([]),
  availability: availabilityEnum("availability").default("available"),
  customStatus: varchar("custom_status", { length: 255 }),
  accentColor: varchar("accent_color", { length: 50 }),
  lastSeen: bigint("last_seen", { mode: "number" }),
  isActive: boolean("is_active").default(true),
  mustChangePassword: boolean("must_change_password").default(false),
  passwordChangedAt: bigint("password_changed_at", { mode: "number" }),
  tempAuthCode: varchar("temp_auth_code", { length: 20 }),
  tempAuthCodeExpiresAt: bigint("temp_auth_code_expires_at", { mode: "number" }),
  soundPrefs: jsonb("sound_prefs").$type<Record<string, string>>().default({}),
  customSoundUrl: text("custom_sound_url"),
  approvedPermissions: jsonb("approved_permissions").$type<string[]>().default([]),
  notificationPrefs: jsonb("notification_prefs").$type<{
    mentions: boolean; directMessages: boolean; groupMessages: boolean;
    calls: boolean; meetings: boolean; announcements: boolean;
    sound: boolean; desktop: boolean;
  }>(),
  emailVerified: boolean("email_verified").default(false),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
}, (table) => [
  index("users_email_idx").on(table.email),
  index("users_company_idx").on(table.company),
  index("users_role_idx").on(table.role),
]);

// ── Passwords ──────────────────────────────────────────────────────────
export const passwords = pgTable("passwords", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  hash: text("hash").notNull(),
  history: jsonb("history").$type<string[]>().default([]),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
}, (table) => [
  uniqueIndex("passwords_user_idx").on(table.userId),
]);

// ── Presence ───────────────────────────────────────────────────────────
export const presence = pgTable("presence", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  status: presenceStatusEnum("status").default("offline"),
  customStatus: varchar("custom_status", { length: 255 }),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
}, (table) => [
  uniqueIndex("presence_user_idx").on(table.userId),
]);

// ── Devices ────────────────────────────────────────────────────────────
export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  platform: varchar("platform", { length: 100 }),
  isTrusted: boolean("is_trusted").default(false),
  isCurrent: boolean("is_current").default(false),
  lastActiveAt: bigint("last_active_at", { mode: "number" }).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => [
  index("devices_user_idx").on(table.userId),
]);

// ── Organizations ──────────────────────────────────────────────────────
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }),
  description: text("description"),
  logo: text("logo"),
  ownerId: uuid("owner_id").references(() => users.id).notNull(),
  plan: varchar("plan", { length: 100 }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => [
  index("orgs_owner_idx").on(table.ownerId),
  index("orgs_name_idx").on(table.name),
  uniqueIndex("orgs_slug_idx").on(table.slug),
]);

// ── Organization Members ───────────────────────────────────────────────
export const organizationMembers = pgTable("organization_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  role: orgMemberRoleEnum("role").default("member"),
  department: varchar("department", { length: 255 }),
  designation: varchar("designation", { length: 255 }),
  joinedAt: bigint("joined_at", { mode: "number" }).notNull(),
}, (table) => [
  index("org_members_org_idx").on(table.orgId),
  index("org_members_user_idx").on(table.userId),
  uniqueIndex("org_members_unique").on(table.orgId, table.userId),
]);

// ── Teams ──────────────────────────────────────────────────────────────
export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => [
  index("teams_org_idx").on(table.orgId),
]);

// ── Team Members ───────────────────────────────────────────────────────
export const teamMembers = pgTable("team_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  role: teamMemberRoleEnum("role").default("member"),
  joinedAt: bigint("joined_at", { mode: "number" }).notNull(),
}, (table) => [
  index("team_members_team_idx").on(table.teamId),
  index("team_members_user_idx").on(table.userId),
  uniqueIndex("team_members_unique").on(table.teamId, table.userId),
]);

// ── Conversations ──────────────────────────────────────────────────────
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: conversationKindEnum("kind").notNull(),
  chatType: chatTypeEnum("chat_type"),
  channelKind: channelKindEnum("channel_kind"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  image: text("image"),
  avatarStorageId: varchar("avatar_storage_id", { length: 255 }),
  orgId: uuid("org_id").references(() => organizations.id),
  teamId: uuid("team_id").references(() => teams.id),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  isPrivate: boolean("is_private").default(false),
  isMeeting: boolean("is_meeting").default(false),
  policies: jsonb("policies").$type<{
    whoCanSend?: "everyone" | "admins";
    whoCanManageMembers?: "everyone" | "admins";
    whoCanEditInfo?: "everyone" | "admins";
  }>(),
  lastMessageAt: bigint("last_message_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => [
  index("convs_org_idx").on(table.orgId),
  index("convs_kind_idx").on(table.kind),
  index("convs_created_by_idx").on(table.createdBy),
]);

// ── Conversation Members ───────────────────────────────────────────────
export const conversationMembers = pgTable("conversation_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  role: memberRoleEnum("role").default("member"),
  lastReadAt: bigint("last_read_at", { mode: "number" }),
  isMuted: boolean("is_muted").default(false),
  isArchived: boolean("is_archived").default(false),
  isPinned: boolean("is_pinned").default(false),
  joinedAt: bigint("joined_at", { mode: "number" }).notNull(),
}, (table) => [
  index("conv_members_conv_idx").on(table.conversationId),
  index("conv_members_user_idx").on(table.userId),
  uniqueIndex("conv_members_unique").on(table.conversationId, table.userId),
]);

// ── Messages ───────────────────────────────────────────────────────────
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "cascade" }).notNull(),
  senderId: uuid("sender_id").references(() => users.id).notNull(),
  body: text("body").notNull(),
  kind: messageKindEnum("kind").default("text"),
  parentId: uuid("parent_id"),
  edited: boolean("edited").default(false),
  deleted: boolean("deleted").default(false),
  forwarded: boolean("forwarded").default(false),
  pinned: boolean("pinned").default(false),
  hiddenFor: jsonb("hidden_for").$type<string[]>().default([]),
  mentions: jsonb("mentions").$type<string[]>().default([]),
  attachments: jsonb("attachments").$type<{
    storageId?: string; url?: string; name: string; mimeType: string; size: number; kind?: string;
  }[]>().default([]),
  poll: jsonb("poll").$type<{
    question: string;
    options: { id: string; text: string; votes: string[] }[];
    closed?: boolean;
  }>(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }),
}, (table) => [
  index("messages_conv_idx").on(table.conversationId, table.createdAt),
  index("messages_parent_idx").on(table.parentId, table.createdAt),
  index("messages_sender_idx").on(table.senderId),
]);

// ── Reactions ──────────────────────────────────────────────────────────
export const reactions = pgTable("reactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id").references(() => messages.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  emoji: varchar("emoji", { length: 50 }).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => [
  index("reactions_msg_idx").on(table.messageId),
  uniqueIndex("reactions_unique").on(table.messageId, table.userId, table.emoji),
]);

// ── Pinned Messages ────────────────────────────────────────────────────
export const pinnedMessages = pgTable("pinned_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "cascade" }).notNull(),
  messageId: uuid("message_id").references(() => messages.id, { onDelete: "cascade" }).notNull(),
  pinnedBy: uuid("pinned_by").references(() => users.id).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => [
  index("pinned_conv_idx").on(table.conversationId),
]);

// ── Bookmarks ──────────────────────────────────────────────────────────
export const bookmarks = pgTable("bookmarks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  messageId: uuid("message_id").references(() => messages.id, { onDelete: "cascade" }).notNull(),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "cascade" }).notNull(),
  folder: varchar("folder", { length: 255 }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => [
  index("bookmarks_user_idx").on(table.userId),
]);

// ── Typing ─────────────────────────────────────────────────────────────
export const typing = pgTable("typing", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
}, (table) => [
  index("typing_conv_idx").on(table.conversationId),
  index("typing_user_idx").on(table.userId),
]);

// ── Files ──────────────────────────────────────────────────────────────
export const folders = pgTable("folders", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").references(() => users.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  parentId: uuid("parent_id"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => [
  index("folders_owner_idx").on(table.ownerId),
]);

export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").references(() => users.id).notNull(),
  conversationId: uuid("conversation_id").references(() => conversations.id),
  folderId: uuid("folder_id").references(() => folders.id),
  name: varchar("name", { length: 500 }).notNull(),
  mimeType: varchar("mime_type", { length: 255 }).notNull(),
  size: bigint("size", { mode: "number" }).notNull(),
  storageId: varchar("storage_id", { length: 255 }).notNull(),
  url: text("url").notNull(),
  kind: varchar("kind", { length: 50 }),
  version: integer("version").default(1),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => [
  index("files_owner_idx").on(table.ownerId, table.createdAt),
  index("files_conv_idx").on(table.conversationId),
  index("files_folder_idx").on(table.folderId),
]);

// ── Meetings ───────────────────────────────────────────────────────────
export const meetings = pgTable("meetings", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  hostId: uuid("host_id").references(() => users.id).notNull(),
  orgId: uuid("org_id").references(() => organizations.id),
  kind: meetingKindEnum("kind").default("meeting"),
  lobbyEnabled: boolean("lobby_enabled").default(false),
  locked: boolean("locked").default(false),
  breakoutRooms: jsonb("breakout_rooms").$type<{
    id: string; name: string; participantIds: string[]; childMeetingId?: string;
  }[]>(),
  breakoutsActive: boolean("breakouts_active").default(false),
  breakoutDurationMinutes: integer("breakout_duration_minutes"),
  breakoutEndsAt: bigint("breakout_ends_at", { mode: "number" }),
  parentMeetingId: uuid("parent_meeting_id"),
  roomCode: varchar("room_code", { length: 50 }).notNull(),
  password: varchar("password", { length: 255 }),
  startTime: bigint("start_time", { mode: "number" }).notNull(),
  endTime: bigint("end_time", { mode: "number" }),
  status: meetingStatusEnum("status").default("scheduled"),
  inviteEmails: jsonb("invite_emails").$type<string[]>().default([]),
  recordingEnabled: boolean("recording_enabled").default(false),
  slug: varchar("slug", { length: 255 }),
  openToEveryone: boolean("open_to_everyone").default(true),
  lastActiveAt: bigint("last_active_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => [
  index("meetings_host_idx").on(table.hostId),
  index("meetings_org_idx").on(table.orgId),
  index("meetings_status_idx").on(table.status, table.startTime),
  uniqueIndex("meetings_room_code_idx").on(table.roomCode),
  index("meetings_slug_idx").on(table.slug),
]);

// ── Meeting Participants ───────────────────────────────────────────────
export const meetingParticipants = pgTable("meeting_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  meetingId: uuid("meeting_id").references(() => meetings.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  role: meetingParticipantRoleEnum("role").default("participant"),
  status: meetingParticipantStatusEnum("status").default("active"),
  joinedAt: bigint("joined_at", { mode: "number" }).notNull(),
  leftAt: bigint("left_at", { mode: "number" }),
  isMuted: boolean("is_muted").default(false),
  isVideoOn: boolean("is_video_on").default(false),
  hasRaisedHand: boolean("has_raised_hand").default(false),
  chatMessages: integer("chat_messages").default(0),
  reactionsSent: integer("reactions_sent").default(0),
  screenShares: integer("screen_shares").default(0),
  muteToggles: integer("mute_toggles").default(0),
  cameraToggles: integer("camera_toggles").default(0),
  handRaises: integer("hand_raises").default(0),
  pollVotes: integer("poll_votes").default(0),
}, (table) => [
  index("meeting_participants_meeting_idx").on(table.meetingId),
  index("meeting_participants_user_idx").on(table.userId),
  uniqueIndex("meeting_participants_unique").on(table.meetingId, table.userId),
]);

// ── Meeting Activity Log ───────────────────────────────────────────────
export const meetingActivityLog = pgTable("meeting_activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  meetingId: uuid("meeting_id").references(() => meetings.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  detail: text("detail"),
  at: bigint("at", { mode: "number" }).notNull(),
}, (table) => [
  index("meeting_activity_meeting_idx").on(table.meetingId, table.at),
  index("meeting_activity_user_idx").on(table.userId),
]);

// ── Calls ──────────────────────────────────────────────────────────────
export const calls = pgTable("calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: callKindEnum("kind").notNull(),
  conversationId: uuid("conversation_id").references(() => conversations.id).notNull(),
  initiatorId: uuid("initiator_id").references(() => users.id).notNull(),
  recipientId: uuid("recipient_id").references(() => users.id).notNull(),
  status: callStatusEnum("status").default("ringing"),
  startedAt: bigint("started_at", { mode: "number" }).notNull(),
  endedAt: bigint("ended_at", { mode: "number" }),
  isRecording: boolean("is_recording").default(false),
}, (table) => [
  index("calls_recipient_idx").on(table.recipientId, table.startedAt),
  index("calls_initiator_idx").on(table.initiatorId, table.startedAt),
  index("calls_conv_idx").on(table.conversationId),
]);

// ── Call Signals ───────────────────────────────────────────────────────
export const callSignals = pgTable("call_signals", {
  id: uuid("id").primaryKey().defaultRandom(),
  callId: uuid("call_id").references(() => calls.id, { onDelete: "cascade" }).notNull(),
  fromId: uuid("from_id").references(() => users.id).notNull(),
  toId: uuid("to_id").references(() => users.id).notNull(),
  kind: signalKindEnum("kind").notNull(),
  payload: text("payload").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => [
  index("call_signals_call_to_idx").on(table.callId, table.toId),
]);

// ── Meeting Signals ────────────────────────────────────────────────────
export const meetingSignals = pgTable("meeting_signals", {
  id: uuid("id").primaryKey().defaultRandom(),
  meetingId: uuid("meeting_id").references(() => meetings.id, { onDelete: "cascade" }).notNull(),
  fromId: uuid("from_id").references(() => users.id).notNull(),
  toId: uuid("to_id").references(() => users.id).notNull(),
  kind: signalKindEnum("kind").notNull(),
  payload: text("payload").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => [
  index("meeting_signals_to_idx").on(table.meetingId, table.toId),
]);

// ── Notifications ──────────────────────────────────────────────────────
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  kind: varchar("kind", { length: 100 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  body: text("body"),
  conversationId: uuid("conversation_id").references(() => conversations.id),
  link: text("link"),
  read: boolean("read").default(false),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => [
  index("notifications_user_idx").on(table.userId, table.createdAt),
]);

// ── Tasks ──────────────────────────────────────────────────────────────
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => organizations.id).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  assigneeId: uuid("assignee_id").references(() => users.id),
  assigneeIds: jsonb("assignee_ids").$type<string[]>().default([]),
  status: taskStatusEnum("status").default("todo"),
  priority: taskPriorityEnum("priority").default("medium"),
  dueDate: bigint("due_date", { mode: "number" }),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => [
  index("tasks_org_idx").on(table.orgId, table.createdAt),
  index("tasks_assignee_idx").on(table.assigneeId),
]);

// ── Contacts ───────────────────────────────────────────────────────────
export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  contactId: uuid("contact_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  isFavorite: boolean("is_favorite").default(false),
  isBlocked: boolean("is_blocked").default(false),
  source: varchar("source", { length: 100 }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => [
  index("contacts_user_idx").on(table.userId),
  index("contacts_contact_idx").on(table.contactId),
  uniqueIndex("contacts_unique").on(table.userId, table.contactId),
]);

// ── Permission Requests ────────────────────────────────────────────────
export const permissionRequests = pgTable("permission_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  permission: varchar("permission", { length: 255 }).notNull(),
  reason: text("reason"),
  status: requestStatusEnum("status").default("pending"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: bigint("reviewed_at", { mode: "number" }),
  expiresAt: bigint("expires_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => [
  index("perm_requests_user_idx").on(table.userId),
  index("perm_requests_status_idx").on(table.status),
]);

// ── Tickets ────────────────────────────────────────────────────────────
export const tickets = pgTable("tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketNumber: varchar("ticket_number", { length: 20 }).notNull(),
  requesterId: uuid("requester_id").references(() => users.id).notNull(),
  kind: ticketKindEnum("kind").notNull(),
  target: varchar("target", { length: 255 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  priority: ticketPriorityEnum("priority").default("normal"),
  category: varchar("category", { length: 255 }),
  status: ticketStatusEnum("status").default("pending"),
  slaFirstResponseAt: bigint("sla_first_response_at", { mode: "number" }),
  slaResolutionAt: bigint("sla_resolution_at", { mode: "number" }),
  slaBreached: boolean("sla_breached").default(false),
  assignedTo: uuid("assigned_to").references(() => users.id),
  assignedAt: bigint("assigned_at", { mode: "number" }),
  pickedUpBy: uuid("picked_up_by").references(() => users.id),
  pickedUpAt: bigint("picked_up_at", { mode: "number" }),
  notes: jsonb("notes").$type<{ authorId: string; text: string; at: number }[]>().default([]),
  approverChain: jsonb("approver_chain").$type<string[]>().notNull().default([]),
  currentLevel: integer("current_level").default(0),
  decisions: jsonb("decisions").$type<{
    approverId: string; action: "approved" | "rejected" | "commented";
    comment?: string; at: number;
  }[]>().default([]),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: bigint("reviewed_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
}, (table) => [
  index("tickets_requester_idx").on(table.requesterId, table.createdAt),
  uniqueIndex("tickets_number_idx").on(table.ticketNumber),
  index("tickets_status_idx").on(table.status, table.createdAt),
]);

// ── Role Permissions ───────────────────────────────────────────────────
export const rolePermissions = pgTable("role_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  role: varchar("role", { length: 100 }).notNull(),
  permissions: jsonb("permissions").$type<Record<string, string | boolean>>().notNull().default({}),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: bigint("updated_at", { mode: "number" }),
}, (table) => [
  uniqueIndex("role_permissions_role_idx").on(table.role),
]);

// ── Audit Logs ─────────────────────────────────────────────────────────
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => organizations.id),
  actorId: uuid("actor_id").references(() => users.id).notNull(),
  action: varchar("action", { length: 255 }).notNull(),
  targetType: varchar("target_type", { length: 100 }),
  targetId: varchar("target_id", { length: 255 }),
  details: text("details"),
  ip: varchar("ip", { length: 50 }),
  device: varchar("device", { length: 255 }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => [
  index("audit_logs_org_idx").on(table.orgId, table.createdAt),
  index("audit_logs_actor_idx").on(table.actorId),
]);

// ── Policies ───────────────────────────────────────────────────────────
export const policies = pgTable("policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => organizations.id),
  title: varchar("title", { length: 500 }).notNull(),
  category: varchar("category", { length: 255 }),
  status: policyStatusEnum("status").default("draft"),
  mandatory: boolean("mandatory").default(false),
  currentVersion: integer("current_version").default(1),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
}, (table) => [
  index("policies_status_idx").on(table.status),
  index("policies_org_idx").on(table.orgId, table.status),
]);

// ── Policy Versions ────────────────────────────────────────────────────
export const policyVersions = pgTable("policy_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  policyId: uuid("policy_id").references(() => policies.id, { onDelete: "cascade" }).notNull(),
  version: integer("version").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  summary: text("summary"),
  content: text("content"),
  effectiveAt: bigint("effective_at", { mode: "number" }),
  publishedBy: uuid("published_by").references(() => users.id),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => [
  index("policy_versions_policy_idx").on(table.policyId, table.version),
  index("policy_versions_effective_idx").on(table.effectiveAt),
]);

// ── Policy Acknowledgements ────────────────────────────────────────────
export const policyAcknowledgements = pgTable("policy_acknowledgements", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => organizations.id),
  userId: uuid("user_id").references(() => users.id).notNull(),
  policyId: uuid("policy_id").references(() => policies.id, { onDelete: "cascade" }).notNull(),
  version: integer("version").notNull(),
  ip: varchar("ip", { length: 50 }),
  userAgent: varchar("user_agent", { length: 500 }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => [
  index("policy_acks_user_policy_idx").on(table.userId, table.policyId, table.version),
  index("policy_acks_policy_version_idx").on(table.policyId, table.version),
  index("policy_acks_user_idx").on(table.userId, table.createdAt),
]);

// ── Payments ───────────────────────────────────────────────────────────
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  orgId: uuid("org_id").references(() => organizations.id),
  planCode: varchar("plan_code", { length: 100 }).notNull(),
  planName: varchar("plan_name", { length: 255 }).notNull(),
  amount: integer("amount").notNull(),
  currency: varchar("currency", { length: 10 }).notNull(),
  orderId: varchar("order_id", { length: 255 }).notNull(),
  paymentId: varchar("payment_id", { length: 255 }),
  signature: varchar("signature", { length: 255 }),
  method: varchar("method", { length: 100 }),
  status: paymentStatusEnum("status").default("created"),
  receipt: varchar("receipt", { length: 255 }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => [
  index("payments_user_idx").on(table.userId, table.createdAt),
  uniqueIndex("payments_order_idx").on(table.orderId),
]);
