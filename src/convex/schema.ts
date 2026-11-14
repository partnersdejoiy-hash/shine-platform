import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
// SHINE enterprise hierarchy (lowest → highest):
// member -> user (Employee) -> tl (Team Leader) -> om (Operations Manager) ->
// director -> president -> it -> super_it -> admin -> dejoiy_admin -> super_admin
// client_admin remains as a tenant-level role used by partner organizations.
export const ROLES = {
  SUPER_ADMIN: "super_admin",
  DEJOIY_ADMIN: "dejoiy_admin",
  ADMIN: "admin",
  SUPER_IT: "super_it",
  IT: "it",
  PRESIDENT: "president",
  DIRECTOR: "director",
  OM: "om",
  TL: "tl",
  CLIENT_ADMIN: "client_admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.SUPER_ADMIN),
  v.literal(ROLES.DEJOIY_ADMIN),
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.SUPER_IT),
  v.literal(ROLES.IT),
  v.literal(ROLES.PRESIDENT),
  v.literal(ROLES.DIRECTOR),
  v.literal(ROLES.OM),
  v.literal(ROLES.TL),
  v.literal(ROLES.CLIENT_ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

// A permission value may be a plain allow/deny boolean, or a scoped value for
// tiered permissions (e.g. "Manage employees" can be team/department-scoped).
export const permissionValueValidator = v.union(
  v.boolean(),
  v.literal("limited"),
  v.literal("team"),
  v.literal("department"),
);
export type PermissionValue = Infer<typeof permissionValueValidator>;

export const presenceStatusValidator = v.union(
  v.literal("online"),
  v.literal("away"),
  v.literal("busy"),
  v.literal("invisible"),
  v.literal("offline"),
);
export type PresenceStatus = Infer<typeof presenceStatusValidator>;

export const availabilityValidator = v.union(
  v.literal("available"),
  v.literal("meeting"),
  v.literal("focus"),
  v.literal("do_not_disturb"),
  v.literal("offline"),
);
export type Availability = Infer<typeof availabilityValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // ---- SHINE identity & profile ------------------------------------------
    users: defineTable({
      name: v.optional(v.string()), // do not remove
      image: v.optional(v.string()), // do not remove
      avatarStorageId: v.optional(v.string()),
      email: v.optional(v.string()), // do not remove
      emailVerificationTime: v.optional(v.number()), // do not remove
      isAnonymous: v.optional(v.boolean()), // do not remove
      role: v.optional(roleValidator), // do not remove

      // extended profile
      phone: v.optional(v.string()),
      bio: v.optional(v.string()),
      coverImage: v.optional(v.string()),
      department: v.optional(v.string()),
      designation: v.optional(v.string()),
      company: v.optional(v.string()),
      location: v.optional(v.string()),
      timezone: v.optional(v.string()),
      employeeId: v.optional(v.string()),
      skills: v.optional(v.array(v.string())),
      socialLinks: v.optional(
        v.array(v.object({ platform: v.string(), url: v.string() })),
      ),
      availability: v.optional(availabilityValidator),
      customStatus: v.optional(v.string()), // the written status everyone sees (like WhatsApp's)
      // how the person wants to show up: "auto" = Active, or Away when idle (like Gmail)
      presenceChoice: v.optional(v.union(v.literal("auto"), v.literal("away"), v.literal("busy"), v.literal("invisible"))),
      chatOff: v.optional(v.boolean()), // an admin switched this person's chat and meetings off (the mail sync never undoes it)
      presenceUntil: v.optional(v.number()), // "Away for 15 min": when the choice goes back to automatic
      // may this person message/email supervisors at other companies? unset = follow their company's setting
      reachSupervisors: v.optional(v.boolean()),
      joiWelcomedAt: v.optional(v.number()), // when Joi said hi to this new person
      accentColor: v.optional(v.string()), // per-user app accent (see lib/accent.ts)
      source: v.optional(v.string()), // "dejoiy-mail" = this person is a Dejoiy Mail mailbox (kept in sync)
      lastSeen: v.optional(v.number()),
      isActive: v.optional(v.boolean()),
      // password compliance: force a change on next sign-in (temp passwords)
      mustChangePassword: v.optional(v.boolean()),
      passwordChangedAt: v.optional(v.number()),
      // email-verified fallback when a temp-password email was missed: a
      // 6-digit code stored with an expiry, consumed when the user sets a
      // new password without knowing the temporary one.
      tempAuthCode: v.optional(v.string()),
      tempAuthCodeExpiresAt: v.optional(v.number()),
      // per-event notification sound ids ("off" | builtin name | "custom:<n>")
      soundPrefs: v.optional(v.record(v.string(), v.string())),
      customSoundUrl: v.optional(v.string()),
      customSoundStorageId: v.optional(v.string()),
      // permissions granted via approved permission requests (e.g. "create_group_chats")
      approvedPermissions: v.optional(v.array(v.string())),
      notificationPrefs: v.optional(
        v.object({
          mentions: v.boolean(),
          directMessages: v.boolean(),
          groupMessages: v.boolean(),
          calls: v.boolean(),
          meetings: v.boolean(),
          announcements: v.boolean(),
          sound: v.boolean(),
          desktop: v.boolean(),
        }),
      ),
    }).index("email", ["email"]), // do not remove or modify

    // per company (email domain): can its employees reach supervisors at other companies on Shine / Dejoiy Mail?
    reachPolicies: defineTable({
      domain: v.string(),
      enabled: v.boolean(),
      updatedBy: v.id("users"),
      updatedAt: v.number(),
    }).index("by_domain", ["domain"]),

    presence: defineTable({
      userId: v.id("users"),
      status: presenceStatusValidator,
      customStatus: v.optional(v.string()),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    devices: defineTable({
      userId: v.id("users"),
      name: v.string(),
      platform: v.optional(v.string()),
      isTrusted: v.boolean(),
      isCurrent: v.optional(v.boolean()),
      lastActiveAt: v.number(),
      createdAt: v.number(),
    }).index("by_user", ["userId"]),

    // bcrypt password hashes, stored separately from the user doc so hashes
    // are never exposed through directory / participant / admin queries.
    // `history` keeps the last N hashes so reusing a recent password is
    // rejected (enterprise password compliance — default 5).
    passwords: defineTable({
      userId: v.id("users"),
      hash: v.string(),
      history: v.optional(v.array(v.string())),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    // ---- Organizations & teams ---------------------------------------------
    organizations: defineTable({
      name: v.string(),
      slug: v.optional(v.string()),
      description: v.optional(v.string()),
      logo: v.optional(v.string()),
      ownerId: v.id("users"),
      plan: v.optional(v.string()),
      domain: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_owner", ["ownerId"])
      .index("by_name", ["name"])
      .index("by_domain", ["domain"])
      .searchIndex("search_name", { searchField: "name" }),

    organizationMembers: defineTable({
      orgId: v.id("organizations"),
      userId: v.id("users"),
      role: v.union(
        v.literal("owner"),
        v.literal("admin"),
        v.literal("member"),
      ),
      department: v.optional(v.string()),
      designation: v.optional(v.string()),
      joinedAt: v.number(),
    })
      .index("by_org", ["orgId"])
      .index("by_user", ["userId"]),

    teams: defineTable({
      orgId: v.id("organizations"),
      name: v.string(),
      description: v.optional(v.string()),
      createdBy: v.id("users"),
      createdAt: v.number(),
    }).index("by_org", ["orgId"]),

    teamMembers: defineTable({
      teamId: v.id("teams"),
      userId: v.id("users"),
      role: v.union(v.literal("lead"), v.literal("member")),
      joinedAt: v.number(),
    })
      .index("by_team", ["teamId"])
      .index("by_user", ["userId"]),

    // ---- Conversations (chats + channels unified) ---------------------------
    conversations: defineTable({
      kind: v.union(v.literal("chat"), v.literal("channel")),
      chatType: v.optional(v.union(v.literal("direct"), v.literal("group"))),
      channelKind: v.optional(
        v.union(v.literal("channel"), v.literal("broadcast"), v.literal("announcement")),
      ),
      name: v.string(),
      description: v.optional(v.string()),
      // group / channel display picture — set by the creator or a group admin
      image: v.optional(v.string()),
      avatarStorageId: v.optional(v.string()),
      orgId: v.optional(v.id("organizations")),
      teamId: v.optional(v.id("teams")),
      createdBy: v.id("users"),
      isPrivate: v.optional(v.boolean()),
      isMeeting: v.optional(v.boolean()),
      // WhatsApp-style group policies
      policies: v.optional(
        v.object({
          // who may send messages: everyone | admins
          whoCanSend: v.optional(v.union(v.literal("everyone"), v.literal("admins"))),
          // who may add/remove members: everyone | admins
          whoCanManageMembers: v.optional(v.union(v.literal("everyone"), v.literal("admins"))),
          // who may edit the group name/photo: everyone | admins
          whoCanEditInfo: v.optional(v.union(v.literal("everyone"), v.literal("admins"))),
        }),
      ),
      lastMessageAt: v.optional(v.number()),
      // #joi only: everyone Joi has added once, so people who leave aren't added back
      joiAdded: v.optional(v.array(v.id("users"))),
      createdAt: v.number(),
    })
      .index("by_org", ["orgId"])
      .index("by_kind", ["kind"])
      .searchIndex("search_name", { searchField: "name" }),

    conversationMembers: defineTable({
      conversationId: v.id("conversations"),
      userId: v.id("users"),
      role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
      lastReadAt: v.optional(v.number()),
      isMuted: v.optional(v.boolean()),
      isArchived: v.optional(v.boolean()),
      isPinned: v.optional(v.boolean()),
      // "Delete chat": this person no longer sees the chat's messages up to this time (everyone else still does)
      clearedAt: v.optional(v.number()),
      joinedAt: v.number(),
    })
      .index("by_conversation", ["conversationId"])
      .index("by_user", ["userId"])
      .index("by_user_conv", ["userId", "conversationId"]),

    // ---- Messages -----------------------------------------------------------
    messages: defineTable({
      conversationId: v.id("conversations"),
      senderId: v.id("users"),
      body: v.string(),
      kind: v.union(
        v.literal("text"),
        v.literal("file"),
        v.literal("voice"),
        v.literal("poll"),
        v.literal("system"),
      ),
      parentId: v.optional(v.id("messages")),
      edited: v.optional(v.boolean()),
      deleted: v.optional(v.boolean()),
      forwarded: v.optional(v.boolean()),
      pinned: v.optional(v.boolean()),
      hiddenFor: v.optional(v.array(v.id("users"))),
      mentions: v.optional(v.array(v.id("users"))),
      attachments: v.optional(
        v.array(
          v.object({
            storageId: v.optional(v.string()),
            url: v.optional(v.string()),
            name: v.string(),
            mimeType: v.string(),
            size: v.number(),
            kind: v.optional(v.string()),
          }),
        ),
      ),
      poll: v.optional(
        v.object({
          question: v.string(),
          options: v.array(
            v.object({
              id: v.string(),
              text: v.string(),
              votes: v.array(v.id("users")),
            }),
          ),
          closed: v.optional(v.boolean()),
        }),
      ),
      createdAt: v.number(),
      updatedAt: v.optional(v.number()),
    })
      .index("by_conversation", ["conversationId", "createdAt"])
      .index("by_parent", ["parentId", "createdAt"])
      .index("by_sender", ["senderId"])
      .searchIndex("search_body", { searchField: "body" }),

    reactions: defineTable({
      messageId: v.id("messages"),
      userId: v.id("users"),
      emoji: v.string(),
      createdAt: v.number(),
    }).index("by_message", ["messageId"]),

    pinnedMessages: defineTable({
      conversationId: v.id("conversations"),
      messageId: v.id("messages"),
      pinnedBy: v.id("users"),
      createdAt: v.number(),
    }).index("by_conversation", ["conversationId"]),

    bookmarks: defineTable({
      userId: v.id("users"),
      messageId: v.id("messages"),
      conversationId: v.id("conversations"),
      folder: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_user", ["userId"]),

    typing: defineTable({
      conversationId: v.id("conversations"),
      userId: v.id("users"),
      expiresAt: v.number(),
    })
      .index("by_conversation", ["conversationId"])
      .index("by_user", ["userId"]),

    // ---- Files --------------------------------------------------------------
    folders: defineTable({
      ownerId: v.id("users"),
      name: v.string(),
      parentId: v.optional(v.id("folders")),
      createdAt: v.number(),
    }).index("by_owner", ["ownerId"]),

    files: defineTable({
      ownerId: v.id("users"),
      conversationId: v.optional(v.id("conversations")),
      folderId: v.optional(v.id("folders")),
      name: v.string(),
      mimeType: v.string(),
      size: v.number(),
      storageId: v.string(),
      url: v.string(),
      kind: v.optional(v.string()),
      version: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_owner", ["ownerId", "createdAt"])
      .index("by_conversation", ["conversationId"])
      .index("by_folder", ["folderId"])
      .searchIndex("search_name", { searchField: "name" }),

    // ---- Meetings -----------------------------------------------------------
    meetings: defineTable({
      title: v.string(),
      description: v.optional(v.string()),
      hostId: v.id("users"),
      orgId: v.optional(v.id("organizations")),
      // "meeting" = interactive video call · "webinar" = host broadcasts, viewers watch
      // "breakout" = child room created by the host's breakout-room feature
      kind: v.optional(v.union(v.literal("meeting"), v.literal("webinar"), v.literal("breakout"))),
      // waiting-room (lobby admission) — when enabled, non-invited joiners wait
      // in a lobby until the host admits them
      lobbyEnabled: v.optional(v.boolean()),
      // host locked the meeting — no new joiners at all
      locked: v.optional(v.boolean()),
      // breakout rooms (id, name, assigned userIds, child meeting once started)
      breakoutRooms: v.optional(
        v.array(
          v.object({
            id: v.string(),
            name: v.string(),
            participantIds: v.array(v.id("users")),
            childMeetingId: v.optional(v.id("meetings")),
          }),
        ),
      ),
      breakoutsActive: v.optional(v.boolean()),
      // timed breakouts: optional duration in minutes (undefined = no time limit)
      breakoutDurationMinutes: v.optional(v.number()),
      // epoch ms at which running timed breakouts should auto-return everyone
      breakoutEndsAt: v.optional(v.number()),
      // set on breakout child meetings → the parent meeting id
      parentMeetingId: v.optional(v.id("meetings")),
      roomCode: v.string(),
      password: v.optional(v.string()),
      startTime: v.number(),
      endTime: v.optional(v.number()),
      status: v.union(
        v.literal("scheduled"),
        v.literal("live"),
        v.literal("ended"),
        v.literal("cancelled"),
      ),
      // email addresses the host invited when scheduling the meeting
      inviteEmails: v.optional(v.array(v.string())),
      // the matching event in the host's Dejoiy Mail (Zimbra) calendar, see calendarLink.ts
      calendarInvId: v.optional(v.string()),
      // host opted in to recording this meeting when scheduling it
      recordingEnabled: v.optional(v.boolean()),
      // URL slug derived from the title — used for the stable shareable link
      // https://<host>/meet/<slug>/<roomCode>
      slug: v.optional(v.string()),
      // when true (default) anyone can join; when false only the host and
      // invited participants may enter (admins included)
      openToEveryone: v.optional(v.boolean()),
      // last time anyone interacted (join/leave/toggle/chat) — idle meetings
      // with nobody present are auto-ended after 30 minutes by the cron sweep
      lastActiveAt: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_host", ["hostId"])
      .index("by_org", ["orgId"])
      .index("by_status", ["status", "startTime"])
      .index("by_roomCode", ["roomCode"])
      .searchIndex("search_title", { searchField: "title" }),

    meetingParticipants: defineTable({
      meetingId: v.id("meetings"),
      userId: v.id("users"),
      // host · moderator (co-host, promoted by the host) · participant
      role: v.union(v.literal("host"), v.literal("moderator"), v.literal("participant")),
      // active · waiting (in the lobby, not yet admitted) · denied
      status: v.optional(v.union(v.literal("active"), v.literal("waiting"), v.literal("denied"))),
      joinedAt: v.number(),
      leftAt: v.optional(v.number()),
      isMuted: v.optional(v.boolean()),
      isVideoOn: v.optional(v.boolean()),
      hasRaisedHand: v.optional(v.boolean()),
      // activity counters for the meeting report (Excel export)
      chatMessages: v.optional(v.number()),
      reactionsSent: v.optional(v.number()),
      screenShares: v.optional(v.number()),
      muteToggles: v.optional(v.number()),
      cameraToggles: v.optional(v.number()),
      handRaises: v.optional(v.number()),
      pollVotes: v.optional(v.number()),
    })
      .index("by_meeting", ["meetingId"])
      .index("by_user", ["userId"]),

    // Timeline of meeting events — powers the meeting report (attendance,
    // activities, screen changes) exported as an Excel sheet.
    meetingActivityLog: defineTable({
      meetingId: v.id("meetings"),
      userId: v.id("users"),
      // join · leave · mute · unmute · camera_on · camera_off · screen_share ·
      // screen_stop · hand_raise · hand_lower · chat · reaction · poll_vote
      type: v.string(),
      detail: v.optional(v.string()),
      at: v.number(),
    })
      .index("by_meeting", ["meetingId", "at"])
      .index("by_user", ["userId"]),

    // ---- Calls (WebRTC signaling) ------------------------------------------
    calls: defineTable({
      kind: v.union(v.literal("audio"), v.literal("video")),
      conversationId: v.id("conversations"),
      initiatorId: v.id("users"),
      recipientId: v.id("users"),
      status: v.union(
        v.literal("ringing"),
        v.literal("active"),
        v.literal("ended"),
        v.literal("declined"),
        v.literal("missed"),
      ),
      startedAt: v.number(),
      endedAt: v.optional(v.number()),
      isRecording: v.optional(v.boolean()),
    })
      .index("by_recipient", ["recipientId", "startedAt"])
      .index("by_initiator", ["initiatorId", "startedAt"])
      .index("by_conversation", ["conversationId"]),

    callSignals: defineTable({
      callId: v.id("calls"),
      fromId: v.id("users"),
      toId: v.id("users"),
      kind: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice")),
      payload: v.string(),
      createdAt: v.number(),
    }).index("by_call_to", ["callId", "toId"]),

    meetingSignals: defineTable({
      meetingId: v.id("meetings"),
      fromId: v.id("users"),
      toId: v.id("users"),
      kind: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice")),
      payload: v.string(),
      createdAt: v.number(),
    }).index("by_meeting_to", ["meetingId", "toId"]),

    // ---- Notifications ------------------------------------------------------
    notifications: defineTable({
      userId: v.id("users"),
      kind: v.string(),
      title: v.string(),
      body: v.optional(v.string()),
      conversationId: v.optional(v.id("conversations")),
      link: v.optional(v.string()),
      read: v.boolean(),
      createdAt: v.number(),
    }).index("by_user", ["userId", "createdAt"]),

    // ---- Tasks --------------------------------------------------------------
    tasks: defineTable({
      orgId: v.id("organizations"),
      title: v.string(),
      description: v.optional(v.string()),
      assigneeId: v.optional(v.id("users")),
      // multiple assignees — the primary (first) id is mirrored into
      // assigneeId for the existing index; the full set lives here
      assigneeIds: v.optional(v.array(v.id("users"))),
      status: v.union(v.literal("todo"), v.literal("in_progress"), v.literal("done")),
      priority: v.optional(
        v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
      ),
      dueDate: v.optional(v.number()),
      createdBy: v.id("users"),
      createdAt: v.number(),
    })
      .index("by_org", ["orgId", "createdAt"])
      .index("by_assignee", ["assigneeId"]),

    // ---- WhatsApp-style Status (24h) ---------------------------------------
    statuses: defineTable({
      userId: v.id("users"),
      kind: v.union(v.literal("text"), v.literal("photo"), v.literal("video"), v.literal("link"), v.literal("emoji")),
      text: v.optional(v.string()),
      mediaUrl: v.optional(v.string()),
      mediaStorageId: v.optional(v.string()),
      mimeType: v.optional(v.string()),
      visibility: v.union(
        v.literal("contacts"),
        v.literal("org"),
        v.literal("everyone"),
        v.literal("custom"),
      ),
      viewCount: v.optional(v.number()),
      viewers: v.optional(
        v.array(v.object({ userId: v.id("users"), at: v.number() })),
      ),
      createdAt: v.number(),
      expiresAt: v.number(),
    })
      .index("by_user", ["userId", "createdAt"])
      .index("by_expiry", ["expiresAt"]),

    // ---- Contacts -----------------------------------------------------------
    contacts: defineTable({
      userId: v.id("users"),
      contactId: v.id("users"),
      isFavorite: v.optional(v.boolean()),
      isBlocked: v.optional(v.boolean()),
      source: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_contact", ["contactId"]),

    // ---- Permission requests (Client Admins & restricted users) -------------
    permissionRequests: defineTable({
      userId: v.id("users"),
      permission: v.string(),
      reason: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
      ),
      reviewedBy: v.optional(v.id("users")),
      reviewedAt: v.optional(v.number()),
      expiresAt: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_status", ["status"]),

    // ---- Enterprise access-request tickets ----------------------------------
    // Any employee can open a ticket (e.g. "I need the X permission"). The
    // ticket is forwarded up the role hierarchy, one approver per level, and
    // the final decision always rests with the super admin. Ticket numbers
    // look like DJT12345 (DJT + five random digits).
    tickets: defineTable({
      ticketNumber: v.string(),
      requesterId: v.id("users"),
      // "permission" → grant approvedPermissions[target]
      // "role"       → promote requester to role `target`
      // "general"    → informational request (no automatic grant)
      // "password"   → password-recovery ticket (auth-page flow)
      // "support"    → enterprise IT / service-desk ticket
      kind: v.union(
        v.literal("permission"),
        v.literal("role"),
        v.literal("general"),
        v.literal("password"),
        v.literal("support"),
        v.literal("org_update"),
      ),
      target: v.string(),
      title: v.string(),
      description: v.optional(v.string()),
      // --- Priority ---
      priority: v.optional(
        v.union(
          v.literal("low"),
          v.literal("normal"),
          v.literal("high"),
          v.literal("urgent"),
          v.literal("critical"),
        ),
      ),
      // --- Category ---
      category: v.optional(v.string()),
      // --- Expanded statuses (backwards-compatible) ---
      // existing: pending | in_progress | approved | rejected | resolved | cancelled
      // new: new | open | assigned | waiting_for_user | waiting_for_approval |
      //      escalated | reopened
      status: v.union(
        v.literal("pending"),
        v.literal("in_progress"),
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("resolved"),
        v.literal("cancelled"),
        v.literal("new"),
        v.literal("open"),
        v.literal("assigned"),
        v.literal("waiting_for_user"),
        v.literal("waiting_for_approval"),
        v.literal("escalated"),
        v.literal("reopened"),
      ),
      // --- SLA ---
      slaFirstResponseAt: v.optional(v.number()),
      slaResolutionAt: v.optional(v.number()),
      slaBreached: v.optional(v.boolean()),
      // --- Assignment ---
      assignedTo: v.optional(v.id("users")),
      assignedAt: v.optional(v.number()),
      // who "picked up" the ticket (assigned the recovery/approval work)
      pickedUpBy: v.optional(v.id("users")),
      pickedUpAt: v.optional(v.number()),
      // teammate collaboration — threaded notes visible to the requester and
      // everyone in the approval chain / tagged staff
      notes: v.optional(
        v.array(
          v.object({
            authorId: v.id("users"),
            text: v.string(),
            at: v.number(),
          }),
        ),
      ),
      // ordered list of approver userIds (lowest above requester → super admin)
      approverChain: v.array(v.id("users")),
      // index into approverChain of who must act next
      currentLevel: v.number(),
      // every decision, in order (enterprise-grade trail)
      decisions: v.optional(
        v.array(
          v.object({
            approverId: v.id("users"),
            action: v.union(
              v.literal("approved"),
              v.literal("rejected"),
              v.literal("commented"),
            ),
            comment: v.optional(v.string()),
            at: v.number(),
          }),
        ),
      ),
      reviewedBy: v.optional(v.id("users")),
      reviewedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_requester", ["requesterId", "createdAt"])
      .index("by_ticket_number", ["ticketNumber"])
      .index("by_status", ["status", "createdAt"]),

    // ---- Role permission matrix overrides ----------------------------------
    // One row per role holding admin-editable permission overrides on top of
    // the system defaults defined in convex/permissions.ts. When empty, the
    // role uses its default matrix. Super Admin row is always locked to all.
    rolePermissions: defineTable({
      role: v.string(),
      permissions: v.record(v.string(), permissionValueValidator),
      updatedBy: v.optional(v.id("users")),
      updatedAt: v.optional(v.number()),
    }).index("by_role", ["role"]),

    // ---- Audit --------------------------------------------------------------
    auditLogs: defineTable({
      orgId: v.optional(v.id("organizations")),
      actorId: v.id("users"),
      action: v.string(),
      targetType: v.optional(v.string()),
      targetId: v.optional(v.string()),
      details: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_org", ["orgId", "createdAt"]),

    // ---- Compliance: versioned policies + mandatory acknowledgements --------
    // A policy is a titled, version-controlled document. Only admins create /
    // publish policies; every publish creates a NEW version row (never mutate
    // a published version). Mandatory policies must be acknowledged by users
    // before they can use the app (enforced by the pending-ack gate).
    policies: defineTable({
      orgId: v.optional(v.id("organizations")),
      title: v.string(),
      category: v.optional(v.string()),
      status: v.union(
        v.literal("draft"),
        v.literal("review"),
        v.literal("approved"),
        v.literal("published"),
        v.literal("superseded"),
        v.literal("archived"),
      ),
      mandatory: v.boolean(),
      currentVersion: v.number(),
      createdBy: v.id("users"),
      updatedBy: v.optional(v.id("users")),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_status", ["status"])
      .index("by_org", ["orgId", "status"]),

    policyVersions: defineTable({
      policyId: v.id("policies"),
      version: v.number(),
      title: v.string(),
      summary: v.optional(v.string()),
      content: v.optional(v.string()),
      effectiveAt: v.optional(v.number()),
      publishedBy: v.optional(v.id("users")),
      createdAt: v.number(),
    })
      .index("by_policy", ["policyId", "version"])
      .index("by_published", ["effectiveAt"]),

    // Append-only: every acknowledgement is a permanent row. A user is
    // considered compliant with a policy when they have an ack row for the
    // policy's CURRENT version. Never overwrite historical acknowledgements.
    policyAcknowledgements: defineTable({
      orgId: v.optional(v.id("organizations")),
      userId: v.id("users"),
      policyId: v.id("policies"),
      version: v.number(),
      ip: v.optional(v.string()),
      userAgent: v.optional(v.string()),
      digest: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_user_policy", ["userId", "policyId", "version"])
      .index("by_policy_version", ["policyId", "version"])
      .index("by_user", ["userId", "createdAt"]),

    // ---- Billing (Razorpay) -------------------------------------------------
    // One row per Razorpay order created from the app. `status` moves
    // created -> paid (after signature-verified payment / webhook) or failed.
    payments: defineTable({
      userId: v.id("users"),
      orgId: v.optional(v.id("organizations")),
      planCode: v.string(),
      planName: v.string(),
      amount: v.number(), // in smallest currency unit (paise for INR)
      currency: v.string(),
      orderId: v.string(), // Razorpay order id (rzp_order_...)
      paymentId: v.optional(v.string()),
      signature: v.optional(v.string()),
      method: v.optional(v.string()),
      status: v.union(
        v.literal("created"),
        v.literal("paid"),
        v.literal("failed"),
        v.literal("refunded"),
      ),
      receipt: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_user", ["userId", "createdAt"])
      .index("by_order", ["orderId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
