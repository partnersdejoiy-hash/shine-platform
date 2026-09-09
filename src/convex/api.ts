/**
 * SHINE — self-hosted API registry.
 *
 * Replaces the Convex-generated `api` object. Each entry maps a frontend
 * "convex function" to a REST endpoint, method, and param strategy.
 *
 * The shape mirrors the old Convex surface so every component keeps
 * working after switching import source from "@/convex/_generated/api"
 * to "@/convex/api".
 */

export interface ApiFn {
  _url: string;
  _method: string;
  _kind: "query" | "mutation" | "action";
  /** Path params extracted from args, e.g. { id } → /foo/:id */
  _pathParams?: string[];
  /** Treat args as a plain body object (POST/PUT). */
  _body?: boolean;
  /** Query string params from args for GET requests. */
  _queryParams?: string[];
}

export type ApiHandler = ApiFn;

function q(url: string, pathParams?: string[], queryParams?: string[]): ApiFn {
  return { _url: url, _method: "GET", _kind: "query", _pathParams: pathParams, _queryParams: queryParams };
}

function m(url: string, pathParams?: string[], body = true): ApiFn {
  return { _url: url, _method: "POST", _kind: "mutation", _pathParams: pathParams, _body: body };
}

function a(url: string, pathParams?: string[], body = true): ApiFn {
  return { _url: url, _method: "POST", _kind: "action", _pathParams: pathParams, _body: body };
}

function put(url: string, pathParams?: string[], body = true): ApiFn {
  return { _url: url, _method: "PUT", _kind: "mutation", _pathParams: pathParams, _body: body };
}

function del(url: string, pathParams?: string[]): ApiFn {
  return { _url: url, _method: "DELETE", _kind: "mutation", _pathParams: pathParams };
}

export const api = {
  users: {
    currentUser: q("/api/auth/me"),
    me: q("/api/auth/me"),
    getUser: q("/api/users/:id", ["id"]),
    searchUsers: q("/api/users/search", undefined, ["q"]),
    mentionSearch: q("/api/users/search", undefined, ["q"]),
    directory: q("/api/users/search", undefined, ["q"]),
    globalSearch: q("/api/users/search", undefined, ["q"]),
    presenceAll: q("/api/users/presence"),
    presenceOf: q("/api/users/presence/:id", ["id"]),
    setStatus: put("/api/users/presence", undefined, true),
    heartbeat: put("/api/users/presence", undefined, true),
    goOffline: put("/api/users/presence", undefined, true),
    updateProfile: put("/api/users/me", undefined, true),
    updateAvatar: put("/api/users/me", undefined, true),
    removeAvatar: put("/api/users/me", undefined, true),
    setAccentColor: put("/api/users/me", undefined, true),
    setSoundPrefs: put("/api/users/me", undefined, true),
    setNotificationPrefs: put("/api/users/me", undefined, true),
    ensureAdmin: m("/api/users/ensure-admin"),
    bootstrapSuperAdmin: m("/api/users/bootstrap-super-admin"),
    bootstrapDejoiyMembership: m("/api/users/bootstrap-dejoiy-membership"),
    myDevices: q("/api/users/devices"),
    registerDevice: m("/api/users/devices", undefined, true),
    setDeviceTrusted: put("/api/users/devices/:id", ["id"]),
    removeDevice: del("/api/users/devices/:id", ["id"]),
    verifyEmail: m("/api/auth/verify-email", undefined, true),
    authProviderStatus: q("/api/auth/provider-status"),
  },

  conversations: {
    list: q("/api/conversations"),
    detail: q("/api/conversations/:id", ["id"]),
    totalUnread: q("/api/conversations/unread-count"),
    openDirectChat: m("/api/conversations/direct", undefined, true),
    createGroupChat: m("/api/conversations/group", undefined, true),
    createChannel: m("/api/conversations/channel", undefined, true),
    joinChannel: m("/api/conversations/:id/join", ["id"]),
    leaveChannel: m("/api/conversations/:id/leave", ["id"]),
    markRead: put("/api/conversations/:id/read", ["id"], true),
    addMember: m("/api/conversations/:id/members", ["id"], true),
    removeMember: del("/api/conversations/:id/members/:userId", ["id", "userId"]),
    setMemberRole: put("/api/conversations/:id/members/:userId", ["id", "userId"], true),
    deleteConversation: del("/api/conversations/:id", ["id"]),
    archiveConversation: m("/api/conversations/:id/archive", ["id"]),
    rename: put("/api/conversations/:id", ["id"], true),
    renameConversation: put("/api/conversations/:id", ["id"], true),
    updateSettings: put("/api/conversations/:id", ["id"], true),
    updateGroupPolicy: put("/api/conversations/:id", ["id"], true),
    setConversationAvatar: put("/api/conversations/:id", ["id"], true),
    setMuted: put("/api/conversations/:id/muted", ["id"], true),
    togglePin: m("/api/conversations/:id/pin", ["id"]),
    getMembers: q("/api/conversations/:id/members", ["id"]),
    setTyping: m("/api/realtime/typing", undefined, true),
    typingIn: q("/api/realtime/typing/:conversationId", ["conversationId"]),
  },

  messages: {
    list: q("/api/messages/conversation/:conversationId", ["conversationId"], ["limit", "before", "after"]),
    conversation: q("/api/messages/conversation/:conversationId", ["conversationId"], ["limit", "before", "after"]),
    listByConversation: q("/api/messages/conversation/:conversationId", ["conversationId"], ["limit", "before", "after"]),
    send: m("/api/messages", undefined, true),
    sendMessage: m("/api/messages", undefined, true),
    edit: put("/api/messages/:id", ["id"], true),
    deleteForEveryone: del("/api/messages/:id", ["id"]),
    deleteForMe: m("/api/messages/:id/delete-me", ["id"]),
    react: m("/api/messages/:id/reactions", ["id"], true),
    removeReaction: del("/api/messages/:id/reactions/:emoji", ["id", "emoji"]),
    getReactions: q("/api/messages/:id/reactions", ["id"]),
    search: q("/api/messages/search", undefined, ["q", "conversationId"]),
    searchInConversation: q("/api/messages/search", undefined, ["q", "conversationId"]),
    globalSearch: q("/api/messages/search", undefined, ["q"]),
    getThread: q("/api/messages/thread/:parentId", ["parentId"]),
    forward: m("/api/messages/:id/forward", ["id"], true),
    pin: m("/api/messages/:id/pin", ["id"]),
    unpin: m("/api/messages/:id/unpin", ["id"]),
    toggleBookmark: m("/api/messages/:id/bookmark", ["id"]),
    myBookmarks: q("/api/messages/bookmarks"),
    createPoll: m("/api/messages/:id/polls", ["id"], true),
    closePoll: m("/api/messages/:id/polls/close", ["id"], true),
    votePoll: m("/api/messages/:id/polls/vote", ["id"], true),
    markRead: put("/api/conversations/:conversationId/read", ["conversationId"], true),
  },

  notifications: {
    list: q("/api/notifications"),
    unreadCount: q("/api/notifications/unread-count"),
    markRead: m("/api/notifications/:id/read", ["id"]),
    markAllNotificationsRead: m("/api/notifications/read-all"),
    markAllRead: m("/api/notifications/read-all"),
  },

  meetings: {
    list: q("/api/meetings"),
    myMeetings: q("/api/meetings"),
    history: q("/api/meetings/history"),
    detail: q("/api/meetings/:id", ["id"]),
    detailByCode: q("/api/meetings/room/:roomCode", ["roomCode"]),
    create: m("/api/meetings", undefined, true),
    join: m("/api/meetings/:id/join", ["id"], true),
    leave: m("/api/meetings/:id/leave", ["id"], true),
    start: m("/api/meetings/:id/start", ["id"]),
    end: m("/api/meetings/:id/end", ["id"]),
    cancel: m("/api/meetings/:id/cancel", ["id"]),
    getParticipants: q("/api/meetings/:id/participants", ["id"]),
    setParticipantState: m("/api/meetings/:id/participants/:userId", ["id", "userId"], true),
    setParticipantRole: m("/api/meetings/:id/participants/:userId/role", ["id", "userId"], true),
    admitParticipant: m("/api/meetings/:id/admit/:userId", ["id", "userId"]),
    removeParticipant: m("/api/meetings/:id/remove/:userId", ["id", "userId"]),
    muteAll: m("/api/meetings/:id/mute-all", ["id"]),
    setLobbyEnabled: m("/api/meetings/:id/lobby", ["id"], true),
    setLocked: m("/api/meetings/:id/locked", ["id"], true),
    adminEndMeeting: m("/api/meetings/:id/admin-end", ["id"]),
    adminLiveMeetings: q("/api/meetings/admin/live"),
    meetingReport: q("/api/meetings/:id/report", ["id"]),
    startBreakouts: m("/api/meetings/:id/breakouts/start", ["id"], true),
    endBreakouts: m("/api/meetings/:id/breakouts/end", ["id"]),
    createBreakoutRooms: m("/api/meetings/:id/breakouts", ["id"], true),
    assignToBreakout: m("/api/meetings/:id/breakouts/assign", ["id"], true),
    logActivity: m("/api/meetings/:id/activity", ["id"], true),
  },

  meetingEmails: {
    sendInviteEmails: m("/api/meetings/:id/emails", ["id"], true),
  },

  files: {
    myFiles: q("/api/files"),
    generateUploadUrl: m("/api/storage/upload-url", undefined, false),
    saveFile: m("/api/files", undefined, true),
    createFolder: m("/api/files/folders", undefined, true),
    deleteFolder: del("/api/files/folders/:id", ["id"]),
    renameFile: put("/api/files/:id", ["id"], true),
    deleteFile: del("/api/files/:id", ["id"]),
    getUploadUrl: m("/api/storage/upload-url", undefined, false),
  },

  tasks: {
    myTasks: q("/api/tasks", undefined, ["orgId"]),
    listByOrg: q("/api/tasks", undefined, ["orgId"]),
    create: m("/api/tasks", undefined, true),
    update: put("/api/tasks/:id", ["id"], true),
    setStatus: put("/api/tasks/:id", ["id"], true),
    remove: del("/api/tasks/:id", ["id"]),
  },

  contacts: {
    list: q("/api/contacts"),
    myContacts: q("/api/contacts"),
    add: m("/api/contacts/:contactId", ["contactId"]),
    remove: del("/api/contacts/:contactId", ["contactId"]),
    toggleFavorite: m("/api/contacts/:contactId/favorite", ["contactId"]),
    toggleBlock: m("/api/contacts/:contactId/block", ["contactId"]),
    suggested: q("/api/contacts/suggested"),
  },

  orgs: {
    myOrgs: q("/api/orgs/my"),
    list: q("/api/orgs"),
    orgDetail: q("/api/orgs/:id", ["id"]),
    create: m("/api/orgs", undefined, true),
    update: put("/api/orgs/:id", ["id"], true),
    invite: m("/api/orgs/:id/members", ["id"], true),
    setMemberRole: put("/api/orgs/:id/members/:userId", ["id", "userId"], true),
    removeMember: del("/api/orgs/:id/members/:userId", ["id", "userId"]),
    createTeam: m("/api/orgs/:orgId/teams", ["orgId"], true),
    teamDetail: q("/api/orgs/:orgId/teams/:teamId", ["orgId", "teamId"]),
    addTeamMember: m("/api/orgs/:orgId/teams/:teamId/members", ["orgId", "teamId"], true),
    removeTeamMember: del("/api/orgs/:orgId/teams/:teamId/members/:userId", ["orgId", "teamId", "userId"]),
    autoJoinByEmailDomain: m("/api/orgs/auto-join", undefined, false),
  },

  admin: {
    stats: q("/api/admin/stats"),
    manageUsers: q("/api/admin/users"),
    allUsers: q("/api/admin/users", undefined, ["limit", "offset", "search"]),
    allOrgs: q("/api/admin/orgs"),
    listOrgs: q("/api/admin/orgs"),
    setUserRole: put("/api/admin/users/:id/role", ["id"], true),
    setUserPermission: put("/api/admin/users/:id/permissions", ["id"], true),
    setUserOrg: put("/api/admin/users/:id/org", ["id"], true),
    toggleUserActive: put("/api/admin/users/:id/active", ["id"], true),
    adminUpdateUserField: put("/api/admin/users/:id", ["id"], true),
    ensureAllEmployeeIds: m("/api/admin/users/ensure-employee-ids"),
    allPermissionRequests: q("/api/permissions/requests"),
    myPermissionRequests: q("/api/permissions/requests"),
    requestPermission: m("/api/permissions/request", undefined, true),
    reviewPermissionRequest: put("/api/permissions/requests/:id", ["id"], true),
    auditLogs: q("/api/audit"),
    health: q("/api/health"),
    ping: q("/api/health"),
    createOrganization: m("/api/orgs", undefined, true),
    deleteOrganization: del("/api/orgs/:id", ["id"]),
    roleHierarchy: q("/api/admin/role-hierarchy"),
    adminBreakdown: q("/api/admin/breakdown"),
  },

  permissions: {
    getAll: q("/api/permissions/roles/:role", ["role"]),
    getRoles: q("/api/permissions/roles/:role", ["role"]),
    getPermissionMatrix: q("/api/permissions/matrix"),
    myPermissionMap: q("/api/permissions/my"),
    myPermissionMapValues: q("/api/permissions/my"),
    requestPermission: m("/api/permissions/request", undefined, true),
    myRequests: q("/api/permissions/requests"),
    reviewRequest: put("/api/permissions/requests/:id", ["id"], true),
    updateRolePermissions: put("/api/permissions/roles/:role", ["role"], true),
    setRolePermission: put("/api/permissions/roles/:role", ["role"], true),
    resetRolePermissions: m("/api/permissions/roles/:role/reset", ["role"]),
  },

  policies: {
    list: q("/api/policies"),
    publishedPolicies: q("/api/policies/published"),
    detail: q("/api/policies/:id", ["id"]),
    acknowledge: m("/api/policies/:id/acknowledge", ["id"]),
    acknowledgePolicy: m("/api/policies/:id/acknowledge", ["id"]),
    pendingAcks: q("/api/policies/pending-acks"),
    createPolicy: m("/api/policies", undefined, true),
    publishPolicy: m("/api/policies/:id/publish", ["id"]),
    myAcks: q("/api/policies/pending-acks"),
    policyStats: q("/api/policies/stats"),
    seedDefaultPolicies: m("/api/policies/seed"),
  },

  tickets: {
    list: q("/api/tickets"),
    myTickets: q("/api/tickets/my"),
    allTickets: q("/api/tickets"),
    approvalQueue: q("/api/tickets/approval-queue"),
    detail: q("/api/tickets/:id", ["id"]),
    create: m("/api/tickets", undefined, true),
    createTicket: m("/api/tickets", undefined, true),
    updateStatus: put("/api/tickets/:id/status", ["id"], true),
    cancelTicket: m("/api/tickets/:id/cancel", ["id"]),
    pickupTicket: m("/api/tickets/:id/pickup", ["id"]),
    decideTicket: m("/api/tickets/:id/decide", ["id"], true),
    addNote: m("/api/tickets/:id/notes", ["id"], true),
    addTicketNote: m("/api/tickets/:id/notes", ["id"], true),
    decide: m("/api/tickets/:id/decide", ["id"], true),
    adminDeleteTicket: del("/api/tickets/:id", ["id"]),
    createPasswordTicket: m("/api/tickets/:id/password-ticket", ["id"], true),
    sendTempPasswordForTicket: m("/api/tickets/:id/send-temp-password", ["id"]),
  },

  calls: {
    start: m("/api/calls/start", undefined, true),
    accept: m("/api/calls/:id/answer", ["id"]),
    decline: m("/api/calls/:id/decline", ["id"]),
    end: m("/api/calls/:id/end", ["id"]),
    liveCalls: q("/api/calls/live"),
    history: q("/api/calls/history"),
    sendSignal: m("/api/calls/signal", undefined, true),
    sendMeetingSignal: m("/api/calls/meeting-signal", undefined, true),
    signalsFor: q("/api/calls/:id/signals", ["id"]),
    meetingSignalsFor: q("/api/calls/meeting-signals/:meetingId", ["meetingId"]),
    setRecording: m("/api/calls/:id/recording", ["id"], true),
  },

  billing: {
    getPlans: q("/api/billing/plans"),
    createOrder: m("/api/billing/create-order", undefined, true),
    verifyPayment: m("/api/billing/verify-payment", undefined, true),
    billingOverview: q("/api/billing/overview"),
    plans: q("/api/billing/plans"),
  },

  billingNode: {
    createOrder: m("/api/billing/create-order", undefined, true),
    verifyPayment: m("/api/billing/verify-payment", undefined, true),
  },

  ai: {
    llm: a("/api/ai/chat", undefined, true),
    chat: a("/api/ai/chat", undefined, true),
    status: q("/api/ai/status"),
    summarizeChat: a("/api/ai/summarize", undefined, true),
    extractActionItems: a("/api/ai/action-items", undefined, true),
    generateReply: a("/api/ai/generate-reply", undefined, true),
    translate: a("/api/ai/translate", undefined, true),
    fixGrammar: a("/api/ai/fix-grammar", undefined, true),
  },

  imports: {
    importUsers: m("/api/users/import", undefined, true),
    exportUsers: q("/api/users/export"),
    bulkUserAction: m("/api/users/bulk", undefined, true),
  },

  passwords: {
    setPassword: m("/api/auth/set-password", undefined, true),
    changePassword: m("/api/auth/change-password", undefined, true),
    resetPassword: m("/api/auth/reset-password", undefined, true),
    setMyPassword: m("/api/auth/set-password", undefined, true),
    setMyPasswordWithCode: m("/api/auth/set-password-code", undefined, true),
    hasPassword: q("/api/auth/has-password"),
    requestPasswordResetCode: m("/api/auth/forgot-password", undefined, true),
    resetPasswordWithCode: m("/api/auth/reset-password", undefined, true),
    requestTempAuthCode: m("/api/auth/temp-code", undefined, true),
    resendMyTempPassword: m("/api/auth/resend-temp-password", undefined, true),
    resendTempPasswordByEmail: m("/api/auth/resend-temp-password", undefined, true),
    adminProvisionPassword: m("/api/auth/admin-provision-password", undefined, true),
    adminSetUserPassword: put("/api/admin/users/:id/password", ["id"], true),
  },

  statuses: {
    list: q("/api/statuses"),
    feed: q("/api/statuses/feed"),
    myStatuses: q("/api/statuses/my"),
    create: m("/api/statuses", undefined, true),
    update: put("/api/statuses/:id", ["id"], true),
    remove: del("/api/statuses/:id", ["id"]),
    view: m("/api/statuses/:id/view", ["id"]),
  },

  rtcConfig: {
    get: q("/api/config/rtc"),
    rtcConfig: q("/api/config/rtc"),
  },

  health: {
    ping: q("/health"),
  },
} as const;