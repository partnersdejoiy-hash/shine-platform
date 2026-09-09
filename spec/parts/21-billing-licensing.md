# Part 21 — Billing & Razorpay Licensing

**Status:** Skeleton · **Depends on:** Part 01, Part 06 · **Last updated:** 2026-08-05

## 1. Purpose

Specify monetization: plans, seat licensing, payments via Razorpay, invoices,
entitlements and license enforcement.

## 2. Detailed outline

### 2.1 Plans & pricing
- Team ($0), Business ($8/seat/mo), Enterprise (custom); feature entitlements
  per plan (participant limits, storage, SSO/SCIM, audit, self-hosting).

### 2.2 Seats & licensing
- Seat model, active/invited seat counting, overage handling, license keys
  for self-hosted, seat reassignment.

### 2.3 Payments (Razorpay)
- Subscriptions, one-time invoices, payment links, webhooks
  (payment.succeeded, subscription events), refunds, failed payment handling.

### 2.4 Invoices & tax
- Invoice generation, GST/invoice formatting (India), invoice history, download.

### 2.5 Entitlement enforcement
- Feature gating server-side, plan change flows, downgrade grace periods,
  org suspension for non-payment.

### 2.6 Billing administration
- Admin billing portal, plan change, usage reports.

## 3. Key decisions locked so far

- Tier definitions in the landing page pricing section (Team/Business/Enterprise).
- Self-hosted: no recurring billing dependency; license-key model.

## 4. Open questions to finalize

- [ ] Razorpay integration details (subscription vs order-based).
- [ ] Trial windows and credit limits.
- [ ] Self-hosted license enforcement mechanism.

## 5. Acceptance criteria (placeholders — deep-dive phase)

| ID | Criteria | Priority |
|----|----------|----------|
| P21-AC-01 | Subscription lifecycle (create, renew, cancel, fail) is automated | Must |
| P21-AC-02 | Seat usage matches billing and enforcement consistently | Must |
| P21-AC-03 | Entitlement gating is enforced server-side, not just UI | Must |
