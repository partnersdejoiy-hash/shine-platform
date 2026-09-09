# Part 10 — Media Engine (Voice, Video, Screen Sharing & Recordings)

**Status:** Skeleton · **Depends on:** Part 02, Part 09 · **Last updated:** 2026-08-05

## 1. Purpose

Specify the media plane: 1:1 calls, group calls, screen sharing, HD quality
features, TURN traversal and recording pipelines.

## 2. Detailed outline

### 2.1 Call model
- 1:1 audio, 1:1 video, group audio/video; call lifecycle (ringing, active,
  ended); call history and live call list.

### 2.2 Media transport
- WebRTC today (P2P + Convex signaling); LiveKit SFU + Coturn for scale.
- Adaptive bitrate, bandwidth detection, low-bandwidth mode, automatic
  reconnection, network diagnostics.

### 2.3 Audio & video processing
- Noise suppression, echo cancellation, background blur, virtual backgrounds,
  camera/mic/speaker selection, multiple cameras, virtual camera support.

### 2.4 Screen sharing
- Full desktop, window, tab; system audio sharing; presenter mode.

### 2.5 Recording & egress
- LiveKit Egress → MinIO (S3), formats, recording lifecycle and webhooks,
  recording permissions (Part 09/15).

### 2.6 Call features
- Hold/resume, transfer, merge, waiting, picture-in-picture, live captions,
  reactions, meeting timer.

### 2.7 Device & network policies
- Media device approval, network/VPN restrictions (Part 18).

## 3. Key decisions locked so far

- 1:1 calls via WebRTC with Convex signaling (`calls.ts`, `use-rtc.ts`).
- Meeting media signals mirrored for MeetingRoom.
- Self-hosted: LiveKit rooms/tokens/egress; Coturn config in deploy/.

## 4. Open questions to finalize

- [ ] SFU capacity planning per node (concurrent streams).
- [ ] Captions engine (LiveKit vs external STT).
- [ ] Recording format/duration limits per plan.

## 5. Acceptance criteria (placeholders — deep-dive phase)

| ID | Criteria | Priority |
|----|----------|----------|
| P10-AC-01 | 1:1 and group calls establish media with <5s connect time | Must |
| P10-AC-02 | Screen share works for desktop, window and tab sources | Must |
| P10-AC-03 | Recordings complete end-to-end and are stored in MinIO | Must |
| P10-AC-04 | Calls survive network changes with automatic reconnection | Should |
