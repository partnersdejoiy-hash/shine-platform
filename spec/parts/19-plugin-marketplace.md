# Part 19 — Plugin Marketplace

**Status:** Skeleton · **Depends on:** Part 20 · **Last updated:** 2026-08-05

## 1. Purpose

Specify the plugin ecosystem: extension points, marketplace, manifests,
security review, and per-org installation.

## 2. Detailed outline

### 2.1 Extension points
- Slash commands, message actions, bot integrations, webhooks, OAuth apps,
  UI extensions (panels/iframes), AI skill hooks.

### 2.2 Plugin manifest
- Manifest schema (id, name, version, permissions, entrypoints, icons),
  versioning and update channel.

### 2.3 Marketplace
- Catalog, categories, search, install/uninstall, ratings, enterprise
  approval workflow (allowlist).

### 2.4 Security & governance
- Permission scopes, review process, sandboxing, revocation, audit of plugin
  activity, plugin data access limits.

## 3. Key decisions locked so far

- None implemented; extension surface will build on REST/webhooks (Part 20)
  and the existing command palette / AI hooks.

## 4. Open questions to finalize

- [ ] Marketplace hosted vs self-hosted catalog for v1.0.
- [ ] Sandboxing approach for third-party code.

## 5. Acceptance criteria (placeholders — deep-dive phase)

| ID | Criteria | Priority |
|----|----------|----------|
| P19-AC-01 | Plugins install/uninstall without data leakage across orgs | Must |
| P19-AC-02 | Enterprise allowlist controls which plugins orgs may use | Must |
| P19-AC-03 | Plugin actions honor the requesting user's permissions | Must |
