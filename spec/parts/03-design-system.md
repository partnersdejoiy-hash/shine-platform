# Part 03 — Design System & UI/UX Foundations

**Status:** Skeleton · **Depends on:** Part 02, Part 04 · **Last updated:** 2026-08-05

## 1. Purpose

Define the visual and interaction language of SHINE — tokens, components,
motion, responsiveness, accessibility — plus the signature experience moments
(login animation, loading states, onboarding, wizards, walkthroughs).

## 2. Detailed outline

### 2.1 Design tokens
- Colors (DEJOIY palette), typography scale, spacing, radii, borders, shadows,
  elevation, opacity; light/dark themes.

### 2.2 Component library
- shadcn/ui foundation, glassmorphism variants, gold accent usage, empty states,
  data tables, toasts (Sonner), dialogs, command palette.

### 2.3 Motion & animation
- Motion tokens (duration/easing), Framer Motion patterns, page transitions,
  list animations, micro-interactions.

### 2.4 Responsive & adaptive behavior
- Breakpoints and UI states for desktop, laptop, tablet, foldables, large and
  small phones, landscape/portrait; no overflow, no hidden controls.

### 2.5 Signature UX moments
- **Cinematic login animation sequence** (logo reveal → glass card entrance →
  gold shimmer → form).
- **Premium loading animations** (splash, skeleton-free spinner, progress).
- **Enterprise onboarding flow** (welcome → profile → invite → tour).
- **Organization creation wizard** (multi-step: identity → branding → roles →
  invite → review).
- **Interactive dashboard walkthrough** (spotlight tours, first-run coach marks).
- **Role-specific first-login experiences** (Super Admin sees admin console;
  Employee sees chat, etc.).

### 2.6 Accessibility
- WCAG 2.2 AA targets, keyboard-first, focus-visible, contrast constraints,
  screen-reader behavior.

## 3. Key decisions locked so far

- Palette: `#0B0B0B` background, `#D4AF37` gold, `#FFFFFF` white, `#8A8F98` grey.
- Glassmorphism + rounded modern UI + Apple-quality polish; no Bootstrap look.
- Dark-first theme; Framer Motion for animation; Tailwind v4 + CSS variables.
- Auth page already has a password/OTP toggle and SSO buttons.

## 4. Open questions to finalize

- [ ] Light-mode treatment (currently dark-first).
- [ ] Login animation storyboard (exact 0–3s sequence).
- [ ] Foldable/dual-screen layout strategy.
- [ ] Motion reduction preference support.

## 5. Acceptance criteria (placeholders — deep-dive phase)

| ID | Criteria | Priority |
|----|----------|----------|
| P03-AC-01 | All UI uses design tokens, never raw hex (except defined palette) | Must |
| P03-AC-02 | All interactive components define default/hover/focus/active/disabled/loading states | Must |
| P03-AC-03 | App renders without overflow or hidden controls at every target breakpoint | Must |
| P03-AC-04 | Login animation completes <3s and is skippable | Should |
| P03-AC-05 | WCAG 2.2 AA contrast and keyboard operability verified | Must |
