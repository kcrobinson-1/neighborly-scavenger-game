# Backlog

## Purpose

Single priority-ordered list of post-MVP follow-up work across all concern
areas. Each entry links to the detail file that explains the full context,
steps, and validation commands.

**How to use this file:**

- Start here to find the highest-priority next item.
- Read the linked detail file before starting any item.
- Mark items `[x]` when complete and update the detail file accordingly.
- Add new items in the correct tier with a one-line why and a detail link.
- `decision` items require a product or design choice before dev work can
  start. `dev`, `ux`, and `infra` items are ready to execute.

**Detail file locations:**

- Open questions and product decisions: [`docs/open-questions.md`](./open-questions.md)
- Terminology migration planning: [`docs/terminology-migration-strategy.md`](./terminology-migration-strategy.md)
- Admin UX polish: [`docs/admin-ux-roadmap.md`](./admin-ux-roadmap.md)
- Contributor workflow tooling: [`docs/dev-workflow-improvements.md`](./dev-workflow-improvements.md)
- Continuous deployment planning: [`docs/continuous-deployment-plan.md`](./continuous-deployment-plan.md)
- Security and abuse planning: [`docs/security-and-abuse-plan.md`](./security-and-abuse-plan.md)
- Code refactors: [`docs/code-refactor-checklist.md`](./code-refactor-checklist.md)
- Test coverage rollout: [`docs/testing.md`](./testing.md)
- Deferred authoring features: [`docs/quiz-authoring-plan.md`](./quiz-authoring-plan.md)
- Release gates, quality-check methodology, and live release-blocking view: [`docs/release-readiness.md`](./release-readiness.md)

---

## Tier 1 — Live Event Readiness

Must be resolved before QR codes are printed or the first real event runs.

- [x] **`feat` Lock slug after first publish**
  Completed: slug is now locked after first publish across admin UI, edge
  function, and DB trigger enforcement.
  Detail: [`docs/open-questions.md` — Authoring And Publishing](./open-questions.md)

- [x] **`dev` Make `sponsor` nullable in `quiz_questions`**
  Completed: unsponsored questions are supported in schema and shared runtime
  types.

- [x] **`dev` Record quiz starts in Supabase**
  Completed: `quiz_starts` persistence is wired from `issue-session` for funnel
  denominator coverage.
  Detail: [`docs/analytics-strategy.md` — Approach 2 and Recommended Sequencing](./analytics-strategy.md)

- [x] **`infra` Production admin smoke workflow**
  Completed: workflow covers deployed admin auth, allowlist, draft save,
  publish/unpublish, and public route state transitions.
  Detail: [`docs/production-admin-smoke-tracking.md`](./production-admin-smoke-tracking.md) and [`docs/testing.md` — Admin Functionality Validation Goal](./testing.md)

- [x] **`infra` Configure production admin smoke settings and rerun release-candidate smoke**
  Completed: production environment settings are configured and release-candidate
  smoke evidence is tracked in the owning doc.
  Detail: [`docs/production-admin-smoke-tracking.md`](./production-admin-smoke-tracking.md)

- [x] **`decision` Volunteer verification affordance**
  Completed decision: pre-launch relies on completion screen + verification code;
  stronger proof is deferred.
  Detail: [`docs/open-questions.md` — Product And Live Event Operation](./open-questions.md)

- [ ] **`decision` Terminology migration strategy (`quiz`/`raffle` -> `game`/`entitlement`)**
  Decide whether and how to reframe product/domain language across code, routes,
  database schema/contracts, and UX copy before launch makes broad cleanup
  risky. Include compatibility/rollout approach so existing paths and data
  references remain stable during transition.
  Detail: [`docs/terminology-migration-strategy.md`](./terminology-migration-strategy.md)

---

## Tier 2 — Operational Confidence

Reduce deployment risk and contributor friction before the live event.

- [x] **`infra` Playwright smoke suite in PR CI**
  Completed: `.github/workflows/ci.yml` now runs
  `npm run test:e2e:attendee:trusted-backend` in PR CI (with Playwright
  browser setup and failure artifact upload), so merge candidates are gated on
  the trusted attendee completion path instead of prototype fallback smoke.
  Detail: [`docs/testing.md` — Where Tests Should Run](./testing.md)

- [x] **`infra` Attendee smoke path must exercise trusted backend completion**
  Completed: `npm run test:e2e:attendee:trusted-backend` now runs a mobile
  attendee smoke flow against local Supabase + local Edge Functions (prototype
  fallback disabled) and asserts trusted backend persistence in
  `raffle_entitlements`, `quiz_completions`, and `quiz_starts`.
  Detail: [`docs/testing.md` — Developer Test Guide](./testing.md)

- [x] **`infra` Attendee smoke invalid submission rejection**
  Completed: trusted-backend attendee smoke now tampers one completion payload
  to trigger backend `400` rejection, asserts the error UI and retry action,
  verifies no `quiz_completions` row persisted for the malformed request id,
  then retries successfully.
  Detail: [`docs/testing.md` — Trust-Path Validation Strategy](./testing.md)

- [x] **`infra` Attendee smoke bootstrap failure messaging**
  Completed: trusted-backend attendee smoke now forces a one-shot
  `issue-session` bootstrap failure, then asserts intro-screen error messaging
  (`Can't start the quiz right now.` + backend failure detail) while preserving
  recoverable start state.
  Detail: [`docs/testing.md` — What Needs Coverage](./testing.md)

- [ ] **`decision` Staging or branch-based Supabase promotion path**
  Decide whether the current local-validation-plus-direct-to-production release
  model is sufficient or whether a staging backend is needed before the first
  real event. A bad migration today goes directly to the production project.
  Detail: [`docs/continuous-deployment-plan.md`](./continuous-deployment-plan.md) and [`docs/open-questions.md` — Development And Release Workflow](./open-questions.md)

- [ ] **`dev` Admin UI-review capture mode**
  Add `npm run ui:review:capture -- --mode admin` (or a sibling script) so
  admin UX PRs have a documented screenshot path that does not write production
  data. Without this, each admin UX PR improvises its own screenshot approach.
  Detail: [`docs/dev-workflow-improvements.md` — Add an admin UI-review capture mode](./dev-workflow-improvements.md)

---

## Tier 3 — Admin Authoring Polish

Improve the authoring experience before the organizer uses it to set up a real
event.

- [ ] **`ux` Mobile question editor layout**
  Rework the question editor stacking on narrow viewports so the question list,
  focused editor, and option controls do not crowd each other. The highest-value
  admin UX refinement before real authoring use.
  Detail: [`docs/admin-ux-roadmap.md` — Improve the mobile question editor layout](./admin-ux-roadmap.md)

- [ ] **`ux` Desktop admin workspace hierarchy**
  Clarify the two-panel balance between the event summary, event-details form,
  and question editor on wide screens. Affects editing confidence before preview
  and publish controls add more surface to the same page.
  Detail: [`docs/admin-ux-roadmap.md` — Clarify the desktop admin workspace hierarchy](./admin-ux-roadmap.md)

- [x] **`dev` Split `useAdminDashboard.ts`** (refactor score 9/10)
  Completed.
  Detail: [`docs/code-refactor-checklist.md`](./code-refactor-checklist.md)

- [x] **`dev` Split `draft-content.ts`** (refactor score 8/10)
  Completed.
  Detail: [`docs/code-refactor-checklist.md`](./code-refactor-checklist.md)

- [x] **`dev` Split `questionBuilder.ts`** (refactor score 8/10)
  Completed.
  Detail: [`docs/code-refactor-checklist.md`](./code-refactor-checklist.md)

---

## Tier 4 — Post-MVP Features

Planned capabilities intentionally deferred from the MVP scope. Require product
prioritization before starting.

- [ ] **`dev` Admin draft preview** (Phase 4.5)
  Let an admin preview the attendee experience from the draft before publishing.
  Detail: [`docs/quiz-authoring-plan.md` — Phase 4.5](./quiz-authoring-plan.md)

- [ ] **`dev` AI-assisted authoring** (Phase 4.7)
  AI-generated draft questions refined by the organizer.
  Detail: [`docs/quiz-authoring-plan.md` — Phase 4.7](./quiz-authoring-plan.md)

- [ ] **`dev` Analytics and reporting**
  SQL views on `quiz_completions`, `raffle_entitlements`, and `quiz_starts`
  (see Tier 1) to produce per-event completion counts, score distributions,
  timing summaries, and sponsor question engagement. Follow-on: an
  organizer-facing reporting section in the admin workspace that surfaces those
  views for a selected event without requiring Supabase Studio access.
  Prerequisite: the Tier 1 quiz starts item must land before the first live
  event or the funnel denominator will be missing.
  Detail: [`docs/analytics-strategy.md`](./analytics-strategy.md)

- [ ] **`decision` Authoring roles and root admin UI**
  Decide whether to add a root-level admin role and UI for managing allowlist
  membership instead of requiring direct SQL edits.
  Priority direction: next milestone.
  Detail: [`docs/open-questions.md` — Authoring And Publishing](./open-questions.md)

- [x] **`dev` Security notes baseline doc**
  Completed on 2026-04-18.
  Created a dedicated security and abuse tracker covering system-integrity and
  game-integrity threat scenarios, MVP accepted risk, and post-MVP hardening
  direction.
  Detail: [`docs/security-and-abuse-plan.md`](./security-and-abuse-plan.md)

- [ ] **`dev` Richer publish controls**
  Expiry windows, scheduled publish, multiple quizzes per event, and friendlier
  inactive-event behavior beyond immediate unpublish.
  Detail: [`docs/open-questions.md` — Authoring And Publishing](./open-questions.md)

- [ ] **`ux` Event landing route model (`/event/:slug` -> `/event/:slug/game`)**
  Move from the current home-plus-direct-game routing shape to an event landing
  model where `/event/:slug` is the event entry surface and gameplay lives on a
  nested route. Intended target once the product starts supporting multiple
  experiences per event so navigation and URL contracts scale cleanly.
  Detail: [`docs/open-questions.md` — Product And Live Event Operation](./open-questions.md)

- [ ] **`decision` Sponsor reporting requirements**
  Determine the minimum reporting slice sponsors actually need: simple inclusion
  proof, aggregate event totals, or question-level reporting.
  Detail: [`docs/open-questions.md` — Reporting And Sponsor Measurement](./open-questions.md)

- [x] **`decision` MVP reward redemption workflow**
  Completed on 2026-04-17.
  Decisions landed for MVP scope: use an event-scoped `agent` role for
  redemption and a separate event-scoped `organizer` role for non-redemption
  event operations; keep redemption on non-admin routes
  (`/event/:slug/redeem` and `/event/:slug/redemptions`); use
  `<event-acronym>-<4-digit-code>` with event-scoped lookup behavior; use
  polling (not realtime subscriptions) every 5 seconds plus manual refresh for
  attendee status updates; keep offline fallback out of MVP; keep assignment
  management as direct SQL inserts for MVP; and allow reversal only from
  organizer/root-admin paths.
  Detail: [`docs/reward-redemption-mvp-design.md`](./reward-redemption-mvp-design.md) and [`docs/open-questions.md` — Product And Live Event Operation](./open-questions.md)

---

## Tier 5 — Code Health And Tooling

Internal maintainability and contributor workflow. No user-facing impact.
Execute in any order.

- [x] **`dev` Audit file-level TSDoc/JSDoc and inline code-documentation gaps**
  Completed on 2026-04-17.
  Detail: [`docs/code-documentation-audit.md`](./code-documentation-audit.md),
  [`docs/dev.md` — Code documentation standard](./dev.md#code-documentation-standard), and [`docs/release-readiness.md` — Code Documentation And Comments](./release-readiness.md#2-code-documentation-and-comments)

- [x] **`dev` Code-documentation remediation Slice A (admin modules)**
  Completed on 2026-04-17.
  Detail: [`docs/code-documentation-audit.md` — Slice A](./code-documentation-audit.md#slice-a--admin-orchestration-and-form-modules)

- [x] **`dev` Code-documentation remediation Slice B (shared barrel clarity)**
  Completed on 2026-04-17.
  Detail: [`docs/code-documentation-audit.md` — Slice B](./code-documentation-audit.md#slice-b--shared-domain-exports-and-barrel-clarity)

- [x] **`dev` Code-documentation remediation Slice C (browser API boundaries)**
  Completed on 2026-04-17.
  Detail: [`docs/code-documentation-audit.md` — Slice C](./code-documentation-audit.md#slice-c--browser-api-boundary-helpers)

- [x] **`dev` Code-documentation remediation Slice D (edge function boundaries)**
  Completed on 2026-04-17.
  Detail: [`docs/code-documentation-audit.md` — Slice D](./code-documentation-audit.md#slice-d--edge-function-boundary-helpers-and-handler-dependencies)

- [x] **`dev` Code-documentation remediation Slice E (migration/RPC invariants)**
  Completed on 2026-04-17.
  Detail: [`docs/code-documentation-audit.md` — Slice E](./code-documentation-audit.md#slice-e--migrationrpc-invariant-comments)

- [ ] **`dev` Split `quizApi.ts` local fallback** (refactor score 8/10)
  Extract local prototype entitlement storage and completion into a separate
  module so the production Supabase path is easier to review.
  Detail: [`docs/code-refactor-checklist.md`](./code-refactor-checklist.md)

- [ ] **`dev` Split `AdminQuestionEditor.tsx`** (refactor score 7/10)
  Extract `AdminQuestionList` and `AdminOptionEditor` so the top-level editor
  reads as buffer/save orchestration.
  Detail: [`docs/code-refactor-checklist.md`](./code-refactor-checklist.md)

- [ ] **`dev` Split `capture-ui-review.cjs` admin mode** (refactor score 7/10)
  Extract admin-specific Supabase mocks and admin screenshot sequences into
  focused helper modules so the shared runner stays readable.
  Detail: [`docs/code-refactor-checklist.md`](./code-refactor-checklist.md)

- [ ] **`dev` Split `AdminEventWorkspace.tsx`** (refactor score 6/10)
  Extract summary card, selected draft header, and action groups so the
  route-level component mainly coordinates layout and callbacks.
  Detail: [`docs/code-refactor-checklist.md`](./code-refactor-checklist.md)

- [ ] **`dev` Split `adminQuizApi.ts`** (refactor score 5/10)
  Extract shared transport and response helpers so the public exports focus on
  intent-specific admin operations.
  Detail: [`docs/code-refactor-checklist.md`](./code-refactor-checklist.md)

- [ ] **`dev` Stable PR screenshot upload path**
  Add `npm run ui:review:upload` backed by a scriptable durable provider so
  agents have a consistent, documented path for uploading UX review images.
  Detail: [`docs/dev-workflow-improvements.md` — Add a stable PR screenshot upload path](./dev-workflow-improvements.md)

- [ ] **`ux` Event details inline vs. dedicated route**
  Decide whether event details should remain in the selected workspace or move
  to a dedicated route once the page gets denser.
  Detail: [`docs/admin-ux-roadmap.md` — Decide whether event details should stay inline](./admin-ux-roadmap.md)

- [ ] **`dev` Broader Playwright coverage**
  Add retry-after-401, backend failure states, and post-merge nightly integration
  scenarios once the core suite is stable.
  Detail: [`docs/testing.md` — Soon After / Later Only If Needed](./testing.md)

- [ ] **`decision` Trust boundary for live events**
  Determine whether browser-session dedupe is sufficient once the product is
  used at real events or whether person-level or device-level controls are
  needed.
  Detail: [`docs/open-questions.md` — Trust Boundary And Abuse Controls](./open-questions.md)
