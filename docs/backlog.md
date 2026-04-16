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
- Admin UX polish: [`docs/admin-ux-roadmap.md`](./admin-ux-roadmap.md)
- Contributor workflow tooling: [`docs/dev-workflow-improvements.md`](./dev-workflow-improvements.md)
- Code refactors: [`docs/code-refactor-checklist.md`](./code-refactor-checklist.md)
- Test coverage rollout: [`docs/testing.md`](./testing.md)
- Deferred authoring features: [`docs/quiz-authoring-plan.md`](./quiz-authoring-plan.md)

---

## Tier 1 — Live Event Readiness

Must be resolved before QR codes are printed or the first real event runs.

- [ ] **`feat` Lock slug after first publish**
  Slugs are read-only once an event is published. The slug field becomes
  non-editable in the admin UI with a clear affordance (padlock icon + tooltip)
  explaining that QR codes and printed URLs depend on it. If a rename is ever
  needed, it must be an intentional manual operation rather than an accidental
  edit. Decision: redirect table was ruled out due to slug-recycling edge cases.
  Detail: [`docs/open-questions.md` — Product And Live Event Operation](./open-questions.md)

- [ ] **`dev` Make `sponsor` nullable in `quiz_questions`**
  The `sponsor` column is currently `NOT NULL`, which forces every question to
  carry a sponsor attribution even when no sponsor is attached. Real events will
  have house questions alongside sponsored ones. This needs a migration to drop
  the `NOT NULL` constraint, a shared-type update to mark `sponsor` as
  `string | null` in `Question`, and follow-up to any rendering or analytics
  logic that assumes the field is always populated. Blocking: analytics sponsor
  engagement queries and admin authoring cannot model unsponsored questions
  correctly until this is resolved.

- [ ] **`dev` Record quiz starts in Supabase**
  Add a `quiz_starts` table (columns: `event_id`, `client_session_id`,
  `issued_at`) and a single INSERT into it from the `issue-session` edge
  function. This gives the denominator for the completion funnel: starts →
  completions → raffle entries. This data is unrecoverable after the event if
  the table is not in place before attendees arrive, which makes it a hard
  pre-event dependency rather than a post-MVP analytics nice-to-have. The
  broader analytics dashboard (Tier 4) depends on this row existing.
  Detail: [`docs/analytics-strategy.md` — Approach 2 and Recommended Sequencing](./analytics-strategy.md)

- [ ] **`infra` Production admin smoke workflow**
  Add a post-release or `workflow_dispatch` smoke check that verifies admin
  auth, allowlist, draft persistence, and publish/unpublish work against the
  deployed production project. Currently no automated check confirms the
  deployed admin surface after a release.
  Detail: [`docs/testing.md` — Admin Functionality Validation Goal, item 7](./testing.md)

---

## Tier 2 — Operational Confidence

Reduce deployment risk and contributor friction before the live event.

- [ ] **`infra` Playwright smoke suite in PR CI**
  Add the existing mobile smoke suite to `.github/workflows/ci.yml`. Today a
  merge can break the attendee flow without CI catching it.
  Detail: [`docs/testing.md` — Where Tests Should Run](./testing.md)

- [ ] **`decision` Staging or branch-based Supabase promotion path**
  Decide whether the current local-validation-plus-direct-to-production release
  model is sufficient or whether a staging backend is needed before the first
  real event. A bad migration today goes directly to the production project.
  Detail: [`docs/open-questions.md` — Development And Release Workflow](./open-questions.md)

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
  Extract selected-draft and mutation state machines into focused hooks so the
  top-level dashboard is auth/loading orchestration rather than one long event
  handler module. Highest-scored refactor; the most-touched file during admin
  work.
  Detail: [`docs/code-refactor-checklist.md`](./code-refactor-checklist.md)

- [ ] **`dev` Split `draft-content.ts`** (refactor score 8/10)
  Move generic JSON expectation helpers and question parsing into focused shared
  modules so `draft-content.ts` reads as the public authoring contract.
  Detail: [`docs/code-refactor-checklist.md`](./code-refactor-checklist.md)

- [ ] **`dev` Split `questionBuilder.ts`** (refactor score 8/10)
  Move structure helpers into a focused module while preserving the existing
  public helper behavior. Affects the authoring data path alongside the above.
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
  Detail: [`docs/open-questions.md` — Authoring And Publishing](./open-questions.md)

- [ ] **`dev` Richer publish controls**
  Expiry windows, scheduled publish, multiple quizzes per event, and friendlier
  inactive-event behavior beyond immediate unpublish.
  Detail: [`docs/open-questions.md` — Authoring And Publishing](./open-questions.md)

- [ ] **`decision` Volunteer verification affordance**
  Define whether live operation needs a timestamp, rotating proof treatment,
  volunteer fallback flow, or anything stronger than the current code-based
  completion proof.
  Detail: [`docs/open-questions.md` — Product And Live Event Operation](./open-questions.md)

- [ ] **`decision` Sponsor reporting requirements**
  Determine the minimum reporting slice sponsors actually need: simple inclusion
  proof, aggregate event totals, or question-level reporting.
  Detail: [`docs/open-questions.md` — Reporting And Sponsor Measurement](./open-questions.md)

---

## Tier 5 — Code Health And Tooling

Internal maintainability and contributor workflow. No user-facing impact.
Execute in any order.

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
