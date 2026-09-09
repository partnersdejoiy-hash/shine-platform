# Part 24 — Desktop & Mobile Applications

**Status:** Skeleton · **Depends on:** Part 03, Part 10, Part 17 · **Last updated:** 2026-08-05

## 1. Purpose

Specify the native-surface strategy: desktop app, mobile apps and PWA, offline
behavior and platform integrations.

## 2. Detailed outline

### 2.1 Desktop application
- Framework choice (Electron vs Tauri), auto-update, tray, native notifications,
  media device handling, multiple monitors, PiP, global shortcuts.

### 2.2 Mobile applications
- iOS/Android strategy (native vs React Native vs PWA), push (FCM/APNs),
  camera/mic permissions, background behavior, app stores.

### 2.3 PWA
- Installable, offline shell, service worker caching, badge/notifications.

### 2.4 Offline & sync
- Offline message queue, sync strategy, conflict resolution, offline
  availability per role policy (Part 18).

### 2.5 Platform parity
- Feature matrix: web vs desktop vs mobile; device-specific UX states
  (Part 03 responsive).

## 3. Key decisions locked so far

- Web is fully responsive across all target form factors today.
- No native apps built yet; PWA path is the near-term default.

## 4. Open questions to finalize

- [ ] Tauri vs Electron for desktop.
- [ ] React Native vs native vs PWA-first for mobile.

## 5. Acceptance criteria (placeholders — deep-dive phase)

| ID | Criteria | Priority |
|----|----------|----------|
| P24-AC-01 | Desktop app matches web feature parity for messaging/media | Should |
| P24-AC-02 | Mobile app receives push and renders all chat/meeting states | Must |
| P24-AC-03 | Offline queue syncs without data loss or duplication | Must |
