# Part 08 — Enterprise Messaging

**Status:** Skeleton · **Depends on:** Part 06, Part 07 · **Last updated:** 2026-08-05

## 1. Purpose

Specify the chat engine at Zoho Cliq / Slack parity: conversations, channels,
threads, rich messaging, moderation, search and read state.

## 2. Detailed outline

### 2.1 Conversation model
- 1:1, group, team, organization, project chats; broadcast and announcement
  channels; meeting-linked chats; conversation member roles and mute state.

### 2.2 Messaging features
- Text, rich text, markdown, code blocks, syntax highlighting, voice messages,
  GIF, emoji picker, stickers, polls, location/contact sharing, file & media
  sharing (links to Part 10/13 storage).

### 2.3 Message lifecycle
- Send, edit, delete-for-me, delete-for-everyone, forward, pin, bookmark,
  star; system messages; message versioning and audit.

### 2.4 Threads & replies
- Parent/child threads, thread notifications, thread navigation.

### 2.5 Mentions & notifications
- @mentions, @channel/@everyone, mention parsing and notification routing
  (detail in Part 17).

### 2.6 Reactions
- Quick reactions, custom reactions, reaction counts and sorting.

### 2.7 Read receipts & presence
- Delivered/seen states, last-read cursor, typing indicators, online presence.

### 2.8 Search
- In-conversation search, global search, filters (sender/date/type),
  Meilisearch index on self-hosted (detail in Part 02).

### 2.9 Moderation & compliance
- Message retention, sensitive-data scanning hooks, export, legal hold
  (detail in Parts 14/15).

## 3. Key decisions locked so far

- Full message engine exists on Convex (send/edit/delete/react/pin/bookmark/
  poll/typing/search) with UI in ChatView/MessageBubble/MessageComposer.
- Conversation kinds: chat, channel (+ meeting conversations).
- Directory is search-only; no proactive employee contact list.

## 4. Open questions to finalize

- [ ] E2E encryption scope for private chats.
- [ ] Broadcast vs announcement permission enforcement (who can post).
- [ ] Voice message transcription.

## 5. Acceptance criteria (placeholders — deep-dive phase)

| ID | Criteria | Priority |
|----|----------|----------|
| P08-AC-01 | 1:1, group, channel and meeting chats all function with full lifecycle | Must |
| P08-AC-02 | Read/delivered/typing state updates in realtime | Must |
| P08-AC-03 | Search returns correct scoped results with filters | Must |
| P08-AC-04 | Moderation and export flows respect retention policy | Must |
