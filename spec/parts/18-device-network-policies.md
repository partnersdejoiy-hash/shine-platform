# Part 18 — Device & Network Security Policies

**Status:** Skeleton · **Depends on:** Part 07 · **Last updated:** 2026-08-05

## 1. Purpose

Specify per-role and per-org device and network access policies: what devices
and networks may access SHINE, and the capability restrictions tied to them.

## 2. Detailed outline

### 2.1 Device policies
- Allowed platforms (desktop/laptop/tablet/mobile), allowed OS
  (windows/linux/macos/android/ios), company-managed vs personal devices,
  browser vs native app access, device fingerprinting, device approval,
  unknown-device block.

### 2.2 Network policies
- Company network only, IP ranges, VPN required, office WiFi, home allowed,
  public network block, trusted networks, country/geo restrictions, travel mode.

### 2.3 Capability restrictions
- Per role/device: exports, uploads, downloads, printing, screen capture,
  clipboard, external sharing, USB, offline access, meetings and chat access.

### 2.4 Enforcement
- Policy evaluation on login and on action; device registry and trust
  (Part 05); audit of policy denials.

## 3. Key decisions locked so far

- Self-hosted Role model carries `allowedPlatforms`, `allowedOs`,
  `allowPersonalDevices`, `requireCompanyNetwork`, `requireVpn`,
  `allowedIpRanges`, `countryRestrictions`, `allowExternalSharing`,
  `allowOfflineAccess`, `allowExports/Uploads/Downloads/Printing`,
  meeting/group/channel capability flags.
- Device registry (`devices` table) with trust/approval/current flags.

## 4. Open questions to finalize

- [ ] Device fingerprinting method for v1.0.
- [ ] Enforcement granularity (login-time vs continuous).
- [ ] Travel-mode approval workflow.

## 5. Acceptance criteria (placeholders — deep-dive phase)

| ID | Criteria | Priority |
|----|----------|----------|
| P18-AC-01 | Policy violations block access at login and during sessions | Must |
| P18-AC-02 | Policy denials are audit-logged | Must |
| P18-AC-03 | Per-role defaults match the approved security matrix | Must |
