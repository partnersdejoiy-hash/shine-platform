# Part 13 — Knowledge Base & Wiki

**Status:** Skeleton · **Depends on:** Part 06, Part 07, Part 08 · **Last updated:** 2026-08-05

## 1. Purpose

Specify the org-wide knowledge base and wiki: documentation, versioning,
permissions, search and AI assistance.

## 2. Detailed outline

### 2.1 Content model
- Spaces, pages, hierarchy, markdown/rich editor, attachments, templates,
  tags and categories.

### 2.2 Versioning & review
- Page history, diffs, restore, draft/review/publish workflow, owners and
  approvers.

### 2.3 Permissions
- Space/page-level ACLs, role-based access, org vs department visibility.

### 2.4 Search & discovery
- Full-text search (Meilisearch), related pages, AI summaries.

### 2.5 Integration
- Link pages in chats/meetings, embed in onboarding, policy docs (Part 14),
  export to PDF.

## 3. Key decisions locked so far

- None implemented yet in the live app; policy documents seeded in the
  self-hosted backend (Policy model with markdown content + versioning).

## 4. Open questions to finalize

- [ ] Editor choice (rich text vs markdown-first) for v1.0.
- [ ] Wiki ↔ Policy overlap boundaries (knowledge base vs compliance docs).

## 5. Acceptance criteria (placeholders — deep-dive phase)

| ID | Criteria | Priority |
|----|----------|----------|
| P13-AC-01 | Pages support full CRUD, versioning and restore | Must |
| P13-AC-02 | ACLs are enforced on every read/write | Must |
| P13-AC-03 | Search indexes pages and returns scoped results | Must |
