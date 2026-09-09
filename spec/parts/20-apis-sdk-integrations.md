# Part 20 — REST APIs, SDKs, OAuth, SCIM, SAML, LDAP

**Status:** Skeleton · **Depends on:** Part 05, Part 06 · **Last updated:** 2026-08-05

## 1. Purpose

Specify the developer surface: REST API, SDKs, OAuth apps, SCIM provisioning,
SAML/OIDC federation and LDAP directory sync.

## 2. Detailed outline

### 2.1 REST API
- Versioned API (`/api/v1`), auth (bearer tokens, API keys), rate limits,
  pagination, filtering, webhooks, error model, idempotency.

### 2.2 SDKs & clients
- Official SDKs (TypeScript/Node, web, mobile), typed clients, generated from
  the OpenAPI spec.

### 2.3 OAuth 2.0 & OIDC
- OAuth authorization server (authorization code, PKCE, client credentials),
  OIDC discovery, token lifecycle, app management.

### 2.4 SCIM provisioning
- SCIM 2.0 endpoints (/Users, /Groups), sync with identity providers,
  org/user provisioning (Part 06).

### 2.5 SAML & LDAP
- SAML SP configuration, IdP-initiated/SP-initiated SSO, LDAP directory sync
  for read-only user/group data.

### 2.6 Webhooks & events
- Outbound event webhooks, retries, signatures, delivery logs.

## 3. Key decisions locked so far

- NestJS API endpoints: auth, users, meetings, health (see `server/README.md`).
- Webhook precedent: LiveKit egress events (`meetings.handleEgressEvent`).

## 4. Open questions to finalize

- [ ] API key management UI and scopes.
- [ ] SDK language priorities (TS, Java, Python, C#).

## 5. Acceptance criteria (placeholders — deep-dive phase)

| ID | Criteria | Priority |
|----|----------|----------|
| P20-AC-01 | All API endpoints are versioned, documented and rate-limited | Must |
| P20-AC-02 | SCIM round-trips user/group provisioning with the IdP | Must |
| P20-AC-03 | OAuth apps can be issued/revoked with audited consent | Must |
