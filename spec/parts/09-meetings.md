# Part 09 — Meetings

**Status:** Skeleton · **Depends on:** Part 10, Part 11, Part 16 · **Last updated:** 2026-08-05

## 1. Purpose

Specify the meeting product at Google Meet / Amazon Chime parity: lifecycle,
room codes, lobby, controls, recording, attendance, scheduling and calendar
integration.

## 2. Detailed outline

### 2.1 Meeting model
- Meetings, participants (host/cohost/moderator/participant), status lifecycle
  (scheduled → live → ended; cancelled), recurring meetings, templates.

### 2.2 Room codes
- `DJM-XXX-000` format, generation, uniqueness, normalization, join-by-code.

### 2.3 Scheduling & invites
- Create with title/time/password/recording/invitee emails; linked meeting chat;
  attendee notification by email with attendee names + room code (Part 16);
  calendar integration (Part 11).

### 2.4 Join & entry controls
- Join by link or code, lobby, waiting room, meeting password, lock,
  host approval, co-hosts.

### 2.5 In-meeting controls
- Mute, camera toggle, raise hand, reactions, meeting chat, screen share,
  live captions, notes, timer, participant management, breakout rooms,
  presenter/spotlight, grid/stage layouts.

### 2.6 Recording & transcription
- Host-triggered recording, egress → MinIO, transcript, summary, attendance
  report, recording permissions and management.

### 2.7 Meeting history & reporting
- History list, attendance, duration, participant join/leave timeline.

### 2.8 Media quality
- Adaptive bitrate, echo cancellation, noise suppression, low-bandwidth mode,
  reconnection (media detail in Part 10).

## 3. Key decisions locked so far

- `DJM-XXX-000` code generation + normalization live in `meetings.ts`.
- Create flow provisions invitees, linked conversation, in-app notifications.
- Recording toggle on schedule; host-only start/end/cancel.
- Self-hosted API: LiveKit rooms, join tokens, egress recording, invite emails.

## 4. Open questions to finalize

- [ ] Waiting-room vs lobby approval UX detail.
- [ ] Breakout room configuration UX for v1.0.
- [ ] Recurring meeting expansion (RRULE) behavior.

## 5. Acceptance criteria (placeholders — deep-dive phase)

| ID | Criteria | Priority |
|----|----------|----------|
| P09-AC-01 | Every scheduled meeting gets a unique DJM-XXX-000 code | Must |
| P09-AC-02 | Invitees receive email with attendee names, code, time, join link | Must |
| P09-AC-03 | Recording is stored and downloadable by permitted roles | Must |
| P09-AC-04 | Attendance report lists join/leave times per participant | Must |
