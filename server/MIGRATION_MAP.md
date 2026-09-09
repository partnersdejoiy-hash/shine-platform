# SHINE — Convex → Self-Hosted Migration Map

## Summary

- **30 Convex function files** → ~150 API endpoints
- **25 database tables** → PostgreSQL
- **31 frontend files** import from Convex
- **Auth**: `@convex-dev/auth` → custom session-based auth (bcrypt + JWT + refresh tokens)
- **Realtime**: Convex subscriptions → Socket.IO
- **Storage**: Convex storage → MinIO (S3-compatible)
- **Search**: Convex search indexes → Meilisearch

## Database Tables (25)

| Convex Table | PostgreSQL Table | Priority |
|---|---|---|
| users | users | P0 |
| presence | presence | P0 |
| devices | devices | P1 |
| passwords | passwords | P0 |
| organizations | organizations | P0 |
| organizationMembers | organization_members | P0 |
| teams | teams | P1 |
| teamMembers | team_members | P1 |
| conversations | conversations | P0 |
| conversationMembers | conversation_members | P0 |
| messages | messages | P0 |
| reactions | reactions | P0 |
| pinnedMessages | pinned_messages | P1 |
| bookmarks | bookmarks | P1 |
| typing | typing | P0 |
| folders | folders | P1 |
| files | files | P0 |
| meetings | meetings | P0 |
| meetingParticipants | meeting_participants | P0 |
| meetingActivityLog | meeting_activity_log | P1 |
| meetingSignals | meeting_signals | P0 |
| calls | calls | P0 |
| callSignals | call_signals | P0 |
| notifications | notifications | P0 |
| tasks | tasks | P1 |
| statuses | statuses | P2 |
| contacts | contacts | P1 |
| permissionRequests | permission_requests | P1 |
| tickets | tickets | P1 |
| ticketNotes (embedded) | ticket_notes | P1 |
| rolePermissions | role_permissions | P0 |
| auditLogs | audit_logs | P0 |
| policies | policies | P1 |
| policyVersions | policy_versions | P1 |
| policyAcknowledgements | policy_acknowledgements | P1 |
| payments | payments | P2 |

## Backend API Modules (NestJS)

| Module | Convex Files | Tables | Realtime? |
|---|---|---|---|
| auth | auth.ts, passwords.ts | users, passwords | No |
| users | users.ts | users, presence, devices | Yes (presence) |
| organizations | orgs.ts, admin.ts | organizations, orgMembers, teams, teamMembers | No |
| conversations | conversations.ts | conversations, conversationMembers | Yes |
| messages | messages.ts | messages, reactions, pinnedMessages, bookmarks, typing | Yes |
| files | files.ts | files, folders | No |
| meetings | meetings.ts, meetingEmails.ts | meetings, meetingParticipants, meetingActivityLog, meetingSignals | Yes |
| calls | calls.ts | calls, callSignals | Yes |
| notifications | notifications.ts | notifications | Yes |
| tasks | tasks.ts | tasks | No |
| contacts | contacts.ts | contacts | No |
| permissions | permissions.ts | rolePermissions, permissionRequests | No |
| tickets | tickets.ts | tickets | No |
| policies | policies.ts | policies, policyVersions, policyAcknowledgements | No |
| admin | admin.ts | auditLogs, users | No |
| billing | billing.ts, billingNode.ts | payments | No |
| ai | ai.ts | (external API) | No |
| statuses | statuses.ts | statuses | No |
| search | (messages.ts globalSearch) | (Meilisearch) | No |

## Socket.IO Events (Realtime)

| Event | Source | Target |
|---|---|---|
| message:new | message.send | conversation members |
| message:edit | message.edit | conversation members |
| message:delete | message.delete | conversation members |
| message:reaction | message.react | conversation members |
| typing:start | conversation.typing | conversation members |
| typing:stop | (expires) | conversation members |
| presence:update | users.heartbeat | all visible users |
| call:incoming | calls.start | recipient |
| call:signal | calls.sendSignal | peer |
| meeting:signal | meetings.sendMeetingSignal | peer |
| meeting:participantUpdate | meetings.join/leave | meeting room |
| notification:new | any mutation | user |
| conversation:update | conversation mutations | members |

## Migration Phases

### Phase 1: Foundation (P0)
1. NestJS scaffold + Docker Compose
2. PostgreSQL schema (Drizzle ORM)
3. Auth module (bcrypt + JWT + refresh tokens)
4. Users + Presence module
5. Organizations module
6. Conversations + Messages module (core chat)
7. Socket.IO realtime layer
8. Frontend API client (replaces Convex hooks)

### Phase 2: Features (P1)
9. Files + Storage (MinIO)
10. Meetings + LiveKit
11. Calls (WebRTC signaling)
12. Notifications
13. Tasks
14. Contacts
15. Tickets
16. Policies + Compliance
17. Permissions + RBAC
18. Admin dashboard
19. Audit logs

### Phase 3: Polish (P2)
20. Statuses (WhatsApp-style)
21. Billing (Razorpay)
22. AI features (OpenAI-compatible)
23. Search (Meilisearch)
24. File security (ClamAV)
25. Monitoring (Prometheus + Grafana)
26. Backups (Restic)
