# Part 05 — Authentication & Auth.js Configuration

**Status:** Skeleton · **Depends on:** Part 02, Part 06 · **Last updated:** 2026-08-05

## 1. Purpose

Define every sign-in method, the Auth.js (NextAuth) configuration, session and
device management, and the security events that accompany authentication.

## 2. Detailed outline

### 2.1 Sign-in methods
- Email + password (primary), email OTP, phone OTP, magic link, passkeys,
  biometric login, anonymous guest, enterprise SSO.

### 2.2 Auth.js configuration
- Providers: credentials, Google, Microsoft Entra ID, GitHub, Apple.
- Prisma adapter (self-hosted), callbacks, secrets (`AUTH_SECRET` /
  `BETTER_AUTH_SECRET`), session strategy, environment variables.

### 2.3 SSO / enterprise federation
- SAML, OIDC, LDAP, SCIM (detail in Part 20).

### 2.4 MFA & account security
- TOTP/2FA, backup codes, MFA enforcement policies, biometrics.

### 2.5 Sessions, devices & trust
- Session lifecycle, remember-me, device registration, trusted devices,
  remote revoke, forced logout, concurrent session limits.

### 2.6 Auth events & audit
- Login, new device, suspicious login, failed attempts, lockout, password
  changed/reset, MFA enabled/disabled, session revoked (audit detail in Part 15).

### 2.7 Login UX
- Cinematic login animation, password/OTP toggle, provider buttons that
  auto-enable from configured keys, return-to redirect handling.

## 3. Key decisions locked so far

- Super admin password login exists today (ConvexCredentials `password` provider).
- `authProviderStatus` gates SSO buttons on real key presence.
- Provider env keys: `AUTH_GOOGLE_ID/SECRET`, `AUTH_GITHUB_ID/SECRET`,
  `AUTH_MICROSOFT_ENTRA_ID_ID/SECRET`, `AUTH_APPLE_ID/SECRET`.
- Self-hosted API: bcrypt + JWT, magic-link, OTP templates.

## 4. Open questions to finalize

- [ ] Passkey/FIDO2 scope for v1.0.
- [ ] Phone OTP provider choice for self-hosted (Twilio vs free alternatives).
- [ ] SSO enforcement rules per plan tier.

## 5. Acceptance criteria (placeholders — deep-dive phase)

| ID | Criteria | Priority |
|----|----------|----------|
| P05-AC-01 | Every sign-in method works end-to-end with its provider configured | Must |
| P05-AC-02 | Disabled/incomplete providers never show as clickable buttons | Must |
| P05-AC-03 | Failed logins, new devices and password changes are audit-logged | Must |
| P05-AC-04 | MFA can be enforced per org/role policy | Should |
| P05-AC-05 | Sessions can be individually revoked and devices remotely removed | Must |
