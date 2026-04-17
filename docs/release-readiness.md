# Release Readiness

## Document Role

This is the living release readiness document for the Neighborly Scavenger Game
repo. It defines how to perform a senior-engineer-grade quality check before a
release candidate is considered ready to run a real event against real
attendees, and it tracks the running state of each quality dimension across
passes.

Use this doc when:

- a release candidate is being prepared for a named live event target (today
  that means Madrona Music in the Playfield; after that, the next organizer
  deployment)
- a change lands that touches the trust boundary, authoring path, publish
  pipeline, mobile attendee flow, or any production runtime configuration
- a contributor or agent needs to understand which release-blocking items are
  still open and where they are tracked

This doc is the release-readiness view. It is not the detail tracker for any
single dimension. Deep tracking lives in the peer docs that already own each
concern, and each section below links to the owning doc. When a new finding
maps onto an existing tracker, add it there and only reference it from here.

Owner docs this file coordinates:

- [backlog.md](./backlog.md) — priority-ordered follow-up work
- [testing.md](./testing.md) — test strategy, coverage snapshot, testing todo list
- [code-refactor-checklist.md](./code-refactor-checklist.md) — behavior-preserving refactor tasks
- [documentation-quality-checklist.md](./documentation-quality-checklist.md) — docs maintenance
- [open-questions.md](./open-questions.md) — unresolved product/UX/architecture decisions
- [analytics-strategy.md](./analytics-strategy.md) — analytics rollout and the only current telemetry surface
- [operations.md](./operations.md) — platform-managed settings and production responsibilities
- [production-admin-smoke-tracking.md](./production-admin-smoke-tracking.md) — post-release smoke triage
- [dev.md](./dev.md) — validation commands and local workflow source of truth

## Scope And Release Target

This doc is bounded to the current MVP stage. It evaluates readiness to run the
existing experience at a real event, not readiness for a general-purpose
analytics platform, multi-tenant authoring product, or high-volume scaling
scenario.

Release-target checklist:

- the attendee mobile flow works end to end against the deployed backend
- organizers can author, publish, and unpublish events through the deployed
  admin surface
- completion trust, entitlement uniqueness, and publish atomicity are proven
  against real database behavior, not mocked
- operational visibility is sufficient to notice and diagnose a failure during
  or shortly after a real event
- every release-blocking open question has a decision or an explicit deferral

Out of scope for this doc:

- broad role/permission design, analytics dashboards, and cross-event
  comparisons that the product intentionally defers post-MVP
- infrastructure-as-code settings migration (see the future option note in
  [operations.md](./operations.md))

## Status Snapshot

Update this section at the start of every quality check pass so the doc never
lags behind the reviewed state. This is the section the doc-currency PR gate
in [AGENTS.md](../AGENTS.md) reads first.

| Field | Value |
| --- | --- |
| Doc established | 2026-04-16 |
| Last full pass | 2026-04-16 — completed with no-go findings |
| Current release target | Madrona Music in the Playfield (initial validation target) |
| Current go/no-go | _no-go — PR CI evidence is pending for this branch_ |
| Blocking items summary | production admin smoke and volunteer verification are resolved; PR CI evidence is still pending |

The first pass produces the initial findings tables under
[Running Findings](#running-findings). Subsequent passes append a new dated
entry and update the Status Snapshot.

## How This Doc Works

This is a living doc. It evolves with the codebase.

Editing rules:

- when a quality check pass runs, update [Status Snapshot](#status-snapshot)
  before editing any other section
- record concrete findings under [Running Findings](#running-findings) with a
  dated entry; do not mutate prior dated entries
- when a finding maps onto an existing tracker (`backlog.md`,
  `testing.md`, `code-refactor-checklist.md`, `open-questions.md`, or
  `documentation-quality-checklist.md`), add it there first, then reference the
  item from this doc; do not duplicate the tracking surface here
- when a finding does not fit any existing tracker, capture it in a short
  bullet in the relevant [Running Findings](#running-findings) dimension and
  either resolve it in the same pass or migrate it into the correct tracker
  before the pass is considered complete
- do not mark a release gate as met on the basis of "tests pass" alone —
  confirm the target shape, coverage, or behavioral claim the gate actually
  describes, consistent with the Refactor Completion Proof and Validation
  Honesty rules in [AGENTS.md](../AGENTS.md)
- keep this doc branch-ready: if a pass stops partway, update Status Snapshot
  to reflect the partial state and do not leave aspirational claims in the
  Release Gates table

Cadence guidance:

- run a full pass before every release candidate that is intended to run a
  live event
- run a scoped pass on any PR that changes the trust boundary, authoring path,
  publish pipeline, mobile attendee flow, CI, migrations, or production
  platform configuration — scoped means the Methodology dimension(s) actually
  touched by the change, not the whole doc
- do not treat routine feature PRs as needing a full pass; rely on the per-PR
  validation already required by [AGENTS.md](../AGENTS.md) and
  [dev.md](./dev.md)

## Release Gates

Each gate below must be met before a release candidate is considered ready for
a live event. A gate is met when the named evidence exists, not merely when
tests pass.

| # | Gate | Evidence required | Tracker of record |
| --- | --- | --- | --- |
| G1 | Trust-path behavior is validated against real Supabase, not mocks only | `npm run test:supabase` passes locally; pgTAP confirms entitlement uniqueness, request idempotency, and verification-code stability | [testing.md — Trust-Path Validation Strategy](./testing.md) |
| G2 | Attendee mobile flow works end to end in a real browser | `npm run test:e2e` passes and the captured mobile smoke sequence covers intro → answer → completion → direct route load | [testing.md — UX And End-To-End Browser Flow](./testing.md) |
| G3 | Admin authoring, publish, and unpublish work against deployed production | `npm run test:e2e:admin:production-smoke` has passed for the release candidate commit (via `Production Admin Smoke` workflow or manual run) | [production-admin-smoke-tracking.md](./production-admin-smoke-tracking.md) |
| G4 | Completion and starts instrumentation is in place for the event | `quiz_starts` and completion tables populate correctly in a local Supabase run; the production Supabase project has both migrations applied before attendees arrive | [analytics-strategy.md — Phase 1 Implementation Plan](./analytics-strategy.md) |
| G5 | Release-blocking open questions are either decided or explicitly deferred | Each item listed in [Release-Blocking Open Questions](#release-blocking-open-questions) has a linked decision or a recorded post-event deferral | [open-questions.md](./open-questions.md) |
| G6 | Operational visibility is sufficient to detect a live event failure | The observability review in [3. Monitoring, Logging, And Observability](#3-monitoring-logging-and-observability) has been completed against the release candidate; any resulting gaps are in `backlog.md` with a Tier 1 or Tier 2 placement or explicitly deferred | [analytics-strategy.md](./analytics-strategy.md) and this doc |
| G7 | Docs describe the implemented state of the release candidate | The doc currency walkthrough in [AGENTS.md — Doc Currency Is a PR Gate](../AGENTS.md) has been executed for the release branch; `README.md`, `docs/architecture.md`, `docs/dev.md`, `docs/testing.md`, `docs/operations.md`, `docs/backlog.md`, and `docs/open-questions.md` match the shipped code | [documentation-quality-checklist.md](./documentation-quality-checklist.md) |
| G8 | PR CI covers the pre-release change set at a meaningful depth | Lint, unit, Deno function tests, local Supabase integration, and build all pass on the release candidate commit via `.github/workflows/ci.yml`; any intentional gap (for example Playwright smoke in PR CI) is a known item in `backlog.md` | [testing.md — Where Tests Should Run](./testing.md) and [backlog.md Tier 2](./backlog.md) |

Gate status is recorded under [Running Findings](#running-findings) at each
pass. Do not edit this table when a gate is met for a single pass — edit the
dated entry instead, so the table stays a durable definition rather than a
snapshot.

## Quality Check Methodology

Each dimension below has the same shape:

- Scope: what the dimension covers and what it does not
- How to run: concrete commands and walks that produce the evidence
- Where findings live: which tracker the result belongs in
- Release bar: what must be true for this dimension to clear

Follow the dimensions in order. Later dimensions assume the earlier ones are
current.

### 1. Test Coverage

Scope:

- unit tests for the shared quiz domain and frontend seams
- integration tests for Edge Function request/response behavior and
  real-Supabase trust-path flows
- end-to-end smoke tests for the attendee mobile flow and the admin authoring
  flow, local and production
- pgTAP tests for database-level rules
- manual checks that are only worth running close to a live event (for
  example, QR code scan → published slug → completion on a real phone)

This dimension does not cover load testing, broad cross-browser matrices, or
visual regression. Those are intentionally deferred per
[testing.md — What Is Overkill Right Now](./testing.md).

How to run:

1. Run `npm run validate:local` from a clean start. This is the integrated
   local gate: lint, unit tests, Deno function tests, attendee Playwright
   smoke, local Supabase integration, the web build, and the Deno checks for
   each Edge Function.
2. Run `npm run test:e2e:admin` against the local Supabase stack to exercise
   admin auth, allowlist, draft save, publish, unpublish, and public route
   state.
3. After merge and deploy, confirm the `Production Admin Smoke` workflow has
   run successfully against the release commit (or trigger a `workflow_dispatch`
   rerun). See [production-admin-smoke-tracking.md](./production-admin-smoke-tracking.md).
4. Walk the [Proposed Test Inventory in testing.md](./testing.md) against the
   current repo and list any item that is no longer representative of the
   shipped behavior. This is the step that catches "tests passed but coverage
   drifted" situations.
5. For any change touching the trust boundary, cross-check against the
   "What Needs Coverage → Supabase Edge Functions" and "What Needs Coverage →
   Supabase Database" sections of `testing.md` and verify each item is still
   exercised.
6. For each user-facing path in scope of the release (attendee featured flow,
   attendee spotlight wrong-answer path, direct route load, admin draft save,
   admin publish, admin unpublish, post-publish public route change), record
   the exact manual confirmation — if any — that was run on real hardware
   against deployed infrastructure. Distinguish manual checks from automated
   coverage.

Where findings live:

- missing automated tests: add to [testing.md — Todo List](./testing.md) with
  an appropriate tier, and link from [backlog.md](./backlog.md) if it is
  release-blocking
- new known-flaky tests: add under
  [testing.md — Known Flaky Tests](./testing.md)
- manual checks required before release: record under
  [Running Findings — Test Coverage](#running-findings), noting the pass date
  and the hardware used

Release bar (see G1, G2, G3, G8):

- trust-path integration is clean on the release commit
- attendee mobile smoke is clean on the release commit
- admin local e2e is clean on the release commit
- admin production smoke has run against the release commit
- every release-blocking gap named in the pass is either closed or explicitly
  deferred with a Tier 1/Tier 2 entry in [backlog.md](./backlog.md)

### 2. Code Documentation And Comments

Scope:

- repo-level docs in `README.md` and `docs/`
- inline function and type documentation at trust, persistence, migration, and
  workflow boundaries
- area readmes where module ownership would otherwise be non-obvious
- comments that explain non-obvious logic or constraint rules

This dimension does not cover JSDoc coverage metrics or any heavyweight
generated documentation site. The repo intentionally keeps docs human-edited,
per [documentation-quality-checklist.md](./documentation-quality-checklist.md).

How to run:

1. Walk every trigger in
   [AGENTS.md — Doc Currency Is a PR Gate](../AGENTS.md) against the release
   branch. For each named doc, confirm it reflects the shipped state.
2. Open the top ~15 largest source files (see the size observation under
   [4. Code Cleanliness And Quality](#4-code-cleanliness-and-quality)) and
   audit public function, hook, and type-level comments for the following:
   - exported symbols at trust, persistence, or publish boundaries have a
     comment that names intent, invariants, and failure modes
   - non-obvious behavior (for example best-effort inserts, retry semantics,
     canonical answer shape) is documented at its definition
   - deprecated or transitional behavior (for example the local prototype
     fallback in `apps/web/src/lib/quizApi.ts`) is clearly labeled
3. Confirm area readmes still describe the current module ownership for any
   area that has been restructured since the last pass (today that includes
   `apps/web/src/game/`, `apps/web/src/admin/`, and `shared/game-config/`).
4. Verify `docs/open-questions.md` no longer includes questions that have been
   answered in code since the last pass, and verify newly introduced
   unresolved decisions are captured there.
5. Confirm status-oriented sections (`Current State`, `Current status`, rollout
   status, phase status) in every touched doc reflect the release-candidate
   state rather than the pre-change state.

Where findings live:

- missing inline comments: fix in the same PR that introduced the undocumented
  behavior; if discovered post-hoc, record a short item under
  [Running Findings — Documentation](#running-findings) and resolve it before
  the release candidate ships
- docs drift: add to
  [documentation-quality-checklist.md](./documentation-quality-checklist.md)
  under the appropriate subsection, and update any stale doc in the same PR as
  the discovering change when practical
- missing area readmes or ownership docs: add a bounded task to
  [documentation-quality-checklist.md](./documentation-quality-checklist.md)

Release bar (see G7):

- every doc named under [AGENTS.md — Doc Currency Is a PR Gate](../AGENTS.md)
  that the release branch should have touched has been updated
- no new exported seam at the trust, persistence, or publish boundary ships
  without an inline comment that explains its intent and failure behavior
- `open-questions.md` has been reviewed for newly answered or newly opened
  items

### 3. Monitoring, Logging, And Observability

Scope:

- structured logging or event emission inside Edge Functions
- browser-side error capture for the attendee and admin flows
- health and uptime signals reachable by the operator during a live event
- post-event forensic data (completions, starts, entitlements, timing)

This dimension covers what is available today and what would need to exist to
notice and diagnose a failure at a live event. It does not mandate adopting a
commercial SDK; it does require a recorded decision about what the operator
would do if a live event looked broken at minute five.

Current posture (as of doc establishment):

- there is no third-party error tracking, session replay, or product analytics
  SDK integrated into the web app
- the only server-side telemetry surface is the best-effort
  `quiz_starts` insert from `issue-session`; completion data lives in
  `quiz_completions` and `raffle_entitlements`
- runtime observability relies on Supabase platform logs for Edge Functions
  and Postgres, plus Vercel deployment logs for the frontend
- no alerting or uptime monitor is configured by the repo; the
  `Production Admin Smoke` workflow is the closest equivalent and runs only
  after release, not continuously

How to run:

1. Review the Edge Function source under `supabase/functions/*/index.ts` and
   confirm every failure branch that matters operationally (invalid origin,
   invalid session, rejected payload, database write failure) produces either
   a distinguishable response code or a deliberate log line — not a silent
   swallow. The current code generally returns structured responses without
   logging; confirm whether that is still the intended posture.
2. Review `apps/web/src/lib/quizApi.ts` and `apps/web/src/lib/adminQuizApi.ts`
   for error paths reachable by real users. Confirm unexpected failures surface
   to the UI instead of being dropped, and confirm the fallback path is still
   gated on `VITE_ENABLE_LOCAL_PROTOTYPE_FALLBACK`.
3. Confirm the production Supabase project has `quiz_starts` migration applied
   before the first live event. Start data is permanently unrecoverable
   otherwise — see [analytics-strategy.md](./analytics-strategy.md).
4. Walk the operator runbook for a live event in
   [operations.md — Live Monitoring And Log Triage](./operations.md#live-monitoring-and-log-triage):
   which dashboards or queries would the on-call contributor open at minute
   five if attendees reported the flow was broken? A recorded answer is the
   deliverable; absence of an answer is the finding.
5. Identify the smallest useful observability improvement that would reduce
   time-to-diagnose at a live event. Candidates worth evaluating:
   - a single structured-log line in each Edge Function error branch
   - a browser error boundary in `apps/web/src/` that reports unhandled
     React errors
   - an uptime or synthetic check for the published `/game/:slug` route and
     for the `issue-session` endpoint
   - a pre-event Supabase query that confirms both new migrations are applied
     and at least one completion can round-trip from a staging device
6. Decide for the current release whether the identified improvement is a
   release-blocker, a Tier 1 item in [backlog.md](./backlog.md), or an
   explicit deferral. Record that decision.

Where findings live:

- observability gaps: add a Tier 1 or Tier 2 item to
  [backlog.md](./backlog.md) with a link to this doc for context
- operator runbook content: keep the durable runbook in
  [operations.md — Live Monitoring And Log Triage](./operations.md#live-monitoring-and-log-triage)
  and summarize release-specific evidence under
  [Running Findings — Monitoring, Logging, Observability](#running-findings)
- analytics-adjacent gaps: add to
  [analytics-strategy.md](./analytics-strategy.md) in the relevant phase

Release bar (see G6):

- the operator knows what they would look at if a live event appeared broken
- Edge Function failure branches are either deliberately silent with a
  recorded reason or produce a diagnosable signal
- analytics-critical data that is unrecoverable after the event (starts,
  completions) is collected

### 4. Code Cleanliness And Quality

Scope:

- file size and responsibility locality
- duplicated logic across frontend and backend
- test-to-code coupling that would block future changes
- lint and type-check hygiene
- consistency with the repo's architecture guardrails in
  [AGENTS.md](../AGENTS.md) and
  [architecture.md](./architecture.md)

This dimension does not try to enforce stylistic preferences beyond the repo's
existing lint and TypeScript settings.

How to run:

1. Run `npm run lint`, `npm test`, `npm run build:web`, and the Deno
   `deno check` commands from [dev.md](./dev.md). A clean run is a
   precondition for the rest of this dimension.
2. Re-check the top ~15 largest `.ts`/`.tsx` source files under
   `apps/web/src/`, `shared/`, and `supabase/functions/` for
   single-responsibility issues. When the last pass was run, the top files
   by size were roughly:
   - `apps/web/src/admin/questionBuilder.ts`
   - `apps/web/src/admin/useSelectedDraft.ts`
   - `apps/web/src/admin/AdminQuestionEditor.tsx`
   - `apps/web/src/admin/AdminEventWorkspace.tsx`
   - `apps/web/src/lib/quizApi.ts`
   - `apps/web/src/admin/useAdminDashboard.ts`
   - `apps/web/src/game/quizSessionState.ts`
   - `shared/game-config/draft-content.ts`
   - `apps/web/src/lib/adminQuizApi.ts`
   - `supabase/functions/publish-draft/index.ts`
   - `shared/game-config/sample-games.ts`
   - `supabase/functions/save-draft/index.ts`
   Re-collect this list at each pass (for example, `wc -l` via bash against
   the tracked source directories) because the shape changes as refactor
   items land.
3. For each oversized file, map it against
   [code-refactor-checklist.md](./code-refactor-checklist.md). If it is
   already in that checklist, do nothing. If it is a new candidate, add it
   there with the specific responsibility problem, the desired target shape,
   and the minimum validation command — following the rules in that file.
4. Walk the architecture guardrails in [AGENTS.md](../AGENTS.md) and confirm
   no guardrail has silently drifted:
   - visual and interaction logic stays in `apps/web/src`
   - shared styling tokens stay in `apps/web/src/styles/`
   - quiz definitions, catalog, validation, and scoring logic stay in
     `shared/game-config`
   - trust, session, persistence, and entitlement logic stay in
     `supabase/functions` and `supabase/migrations`
   - business rules are not casually duplicated across frontend and backend
   - the local browser-only completion fallback is not treated as production
     backend behavior
5. Confirm that every DB write reachable from a public or origin-gated
   endpoint has DB-level referential integrity or constraints, not only
   application-layer validation. This is the hard rule in
   [AGENTS.md — Pre-Edit Gate](../AGENTS.md).
6. Look for recent commits that fixed a bug by adding application-layer
   validation where a migration-level constraint would have been more durable.
   Flag any such case for follow-up as a schema hardening task.

Where findings live:

- file-size and split candidates: add to
  [code-refactor-checklist.md](./code-refactor-checklist.md)
- architectural drift: fix in the PR that introduced it when discovered
  in-review; record a short entry under
  [Running Findings — Cleanliness](#running-findings) when discovered after
  the fact, and either resolve or open a tracker before the release candidate
  ships
- missing DB-level constraints: record in
  [backlog.md](./backlog.md) under the appropriate tier; treat as
  release-blocking if the write is reachable from a public endpoint

Release bar:

- lint, unit, function tests, build, and Deno checks all clean on the release
  commit
- no new file over ~400 lines has been added without a split plan recorded in
  [code-refactor-checklist.md](./code-refactor-checklist.md)
- no architectural guardrail from [AGENTS.md](../AGENTS.md) has drifted
  since the last pass
- every public-write backend endpoint is still referentially protected at the
  database level

### 5. Code Efficiency And Performance

Scope:

- browser-side rendering and network efficiency on the mobile attendee path
- Edge Function latency and dependency footprint
- database query shape and index coverage for the publish, complete, and
  analytics-adjacent surfaces
- bundle size and cold-start cost for the frontend

This dimension is intentionally scoped to the MVP: no synthetic load testing,
no profiler-driven micro-optimizations, no bundle-size regressions framework.
The goal is to catch obvious inefficiencies before a live event, not to
optimize ahead of evidence.

How to run:

1. Read `apps/web/src/lib/quizApi.ts` and `apps/web/src/game/useQuizSession.ts`
   and confirm the attendee path does not do redundant network calls, stash
   duplicate state, or retain listeners that should be cleaned up between
   questions.
2. Run `npm run build:web` and record the reported bundle size in the dated
   Running Findings entry. Flag any meaningful increase over the previous
   recorded size.
3. Spot-check Edge Function handlers in `supabase/functions/*/index.ts` for
   needless work on the hot path — for example, redundant database reads
   before a known write, or JSON parses that could be avoided on the
   unauthenticated/rejected branch.
4. Review `supabase/migrations/` for indexes that would be touched by:
   - the funnel query in [analytics-strategy.md](./analytics-strategy.md)
     (starts → completions → entitlements)
   - the admin authoring path (draft read by `event_id`, publish transaction)
   - the public route lookup by `slug`
   Confirm a planned live-event traffic volume (hundreds of attendees per
   event) will not require an unindexed scan.
5. Note any non-obvious inefficiency that was observed in practice but not
   fixed in the PR that introduced it.

Where findings live:

- concrete inefficiencies: add to [backlog.md](./backlog.md) if
  release-relevant, or to
  [code-refactor-checklist.md](./code-refactor-checklist.md) if the fix is
  behavior-preserving and small
- bundle size observations: record under
  [Running Findings — Efficiency](#running-findings) with the measurement, so
  trend is visible across passes

Release bar:

- no known inefficiency on the attendee path or on the trust-path Edge
  Functions would realistically degrade a live event at the target volume
- bundle size has not grown without a recorded reason
- database queries on the publish, complete, and public route paths are
  indexed

### 6. Open Questions

Scope:

- product, UX, trust, authoring, workflow, and operations decisions that
  materially affect release readiness
- open questions discovered during the current pass

This dimension does not try to re-decide items already answered in code or
docs.

How to run:

1. Read [open-questions.md](./open-questions.md) end to end. For each entry,
   decide one of:
   - still open and not release-blocking for the current target — leave
     as-is
   - still open and release-blocking for the current target — mirror it
     into the list below under
     [Release-Blocking Open Questions](#release-blocking-open-questions),
     with a link back to the canonical entry
   - answered in code, docs, or platform configuration — remove or update the
     entry in `open-questions.md` in the same PR
2. Confirm any new unresolved decision surfaced during this pass is captured
   in `open-questions.md` before the pass closes, per
   [AGENTS.md](../AGENTS.md).
3. For each decision listed in `backlog.md` as `decision`, confirm whether it
   is expected to be decided before the release target. If yes, mirror under
   [Release-Blocking Open Questions](#release-blocking-open-questions).

Where findings live:

- canonical tracking is [open-questions.md](./open-questions.md)
- release-blocking mirror lives in this doc only as a short reference list,
  refreshed at each pass

Release bar (see G5):

- every question listed under
  [Release-Blocking Open Questions](#release-blocking-open-questions) is
  either decided (and linked to the decision) or explicitly deferred with a
  named owner and post-event plan

#### Release-Blocking Open Questions

This subsection is refreshed at each quality check pass. The contents are a
filtered view of [open-questions.md](./open-questions.md) — items that block
the current release target go here. Everything else stays in the canonical
tracker.

Refresh instructions:

- do not invent new entries here; mirror an entry from
  [open-questions.md](./open-questions.md) and link back
- remove an entry when the underlying question is decided, answered in code,
  or explicitly deferred past the current release target
- if an entry has been deferred, record the deferral decision and owner
  directly in [open-questions.md](./open-questions.md), then remove it from
  this list

The list below was refreshed during the 2026-04-16 pass and updated after the
Madrona pre-launch volunteer handoff decision.

- _no entries currently block the release target_

## Running Findings

Each pass appends a new dated entry. Do not rewrite prior entries. Keep the
most recent entry at the top so the latest state is easy to find.

### Template For A New Pass

Copy this template at the start of each pass and fill it in as the pass
progresses.

```markdown
### Pass YYYY-MM-DD

**Reviewer:** <name or agent run id>
**Release target:** <event name or "general hardening">
**Release candidate commit:** <short sha>

**Gates:**

- G1 Trust-path: <met | not met — link to evidence>
- G2 Attendee e2e: <met | not met>
- G3 Admin production smoke: <met | not met>
- G4 Starts + completion instrumentation: <met | not met>
- G5 Release-blocking open questions: <met | not met>
- G6 Observability: <met | not met>
- G7 Docs currency: <met | not met>
- G8 PR CI depth: <met | not met>

**Test coverage:**

- <gap or confirmation, link to tracker>

**Documentation:**

- <gap or confirmation, link to tracker>

**Monitoring, logging, observability:**

- <gap or confirmation, link to tracker>

**Cleanliness:**

- <gap or confirmation, link to tracker>

**Efficiency:**

- <measurement or concern>

**Release-blocking open questions:**

- <short reference list, linking into open-questions.md>

**Go/no-go:** <go | no-go, with a one-sentence reason>

**Follow-ups opened:**

- <link to backlog/tracker item created by this pass>
```

### Pass 2026-04-16

**Reviewer:** coordinator Codex thread
**Release target:** Madrona Music in the Playfield
**Release candidate commit:** 0265683, with follow-up smoke-evidence docs-only status update pending

**Gates:**

- G1 Trust-path: met for the coordinator branch — `npm run validate:local` passed, including `npm run test:supabase`, the real local `issue-session` plus `complete-quiz` integration path, and 90 pgTAP database tests
- G2 Attendee e2e: met for the coordinator branch — `npm run test:e2e` passed 3 mobile Chromium attendee smoke tests after the default Playwright config was restricted to `mobile-smoke.spec.ts`
- G3 Admin production smoke: met — GitHub run `24541137250` passed on the release-readiness branch after fixture defaults and GitHub `production` environment settings were configured
- G4 Starts + completion instrumentation: met — `npm run validate:local` exercised start-row Deno tests, local Supabase integration, and pgTAP; release workflow run `24537097693` successfully applied migrations and deployed functions at `d08f65e`, which already contained `20260416000000_add_quiz_starts.sql` and `20260416010000_add_quiz_starts_event_fk.sql`; `70977d6` is docs-only and its release job was skipped
- G5 Release-blocking open questions: met — Madrona pre-launch volunteer handoff uses the current completion screen plus verification code; stronger proof treatment is deferred until after this release
- G6 Observability: met for the coordinator branch — the live monitoring runbook in [operations.md](./operations.md#live-monitoring-and-log-triage) identifies the manual operator surfaces, and `Production Admin Smoke` run `24541137250` now provides the release-candidate deployed admin signal
- G7 Docs currency: met for the coordinator branch — Dimension 2 doc-currency audit completed, with stale README release-flow and production-smoke status docs updated
- G8 PR CI depth: not met — no PR CI evidence exists for the coordinator branch yet; `.github/workflows/ci.yml` covers lint, unit tests, Deno function tests, local Supabase integration/database tests, build, and function `deno check`, while attendee Playwright smoke in PR CI remains tracked in [backlog.md](./backlog.md)

**Test coverage:**

- `npm run validate:local` initially failed because `npm run test:e2e` picked up admin and production-smoke specs requiring `TEST_SUPABASE_SERVICE_ROLE_KEY`; fixed in this branch by restricting the default Playwright config to `mobile-smoke.spec.ts`.
- After that fix, `npm run validate:local` passed end to end: lint; 23 Vitest files / 175 tests; 34 Deno Edge Function tests; 3 attendee mobile Playwright smoke tests; local Supabase integration and pgTAP database tests; `npm run build:web`; and `deno check` for `issue-session`, `complete-quiz`, `save-draft`, `publish-draft`, and `unpublish-event`.
- `npm run test:e2e:admin` passed 1 local Supabase-backed admin Playwright test covering save, publish, unpublish, and public route verification.
- `Production Admin Smoke` run `24541137250` passed on the release-readiness branch, covering deployed admin auth, allowlist denial, draft save, publish, unpublish, and public route state against the dedicated production smoke fixture.
- Proposed Test Inventory still matches the current suite at a high level: shared-domain tests, frontend session/API/page tests, Deno Edge Function tests, pgTAP database tests, attendee mobile smoke, local admin e2e, and production admin smoke harness all exist. The known gaps remain attendee Playwright smoke in PR CI and broader Playwright retry/backend-failure coverage, both already tracked in [testing.md](./testing.md) or [backlog.md](./backlog.md).

**Documentation:**

- Dimension 2 audit completed for doc-currency triggers, status-oriented docs,
  area readmes, and boundary comments in the largest source files.
- `README.md` release flow was stale because it described CI, Vercel deploy,
  and Supabase release promotion but omitted the production admin smoke
  workflow. Updated it to include the post-release smoke validation step.
- `production-admin-smoke-tracking.md` described the workflow and environment
  contract but did not name the current release-readiness status. Updated it to
  record that release candidate `70977d6` has no successful production smoke
  evidence yet and points to the Tier 1 backlog item.
- Area readmes for `apps/web/src/game/`, `apps/web/src/admin/`, and
  `shared/game-config/` still match the current module ownership at a
  documentation level.
- Boundary comments for trust, persistence, and publish entrypoints in the
  largest source files are present where needed: `issue-session`,
  `complete-quiz`, `save-draft`, `publish-draft`, `quizApi`, and
  `adminQuizApi` document the non-obvious trust, fallback, or auth-token
  behavior that affects future maintainers.

**Monitoring, logging, observability:**

- Dimension 3 audit completed for Edge Function error responses, browser API
  error surfacing, release workflow state, production smoke state, and current
  operator surfaces.
- Edge Functions currently return distinguishable HTTP statuses and structured
  JSON errors for important failure branches rather than writing explicit
  `console` logs. That posture is deliberate for the MVP: caller-visible
  failures surface to the UI, while Supabase platform request/function logs
  remain the backend investigation surface. The one deliberately swallowed
  server-side failure is `issue-session` start tracking; comments explain that
  `quiz_starts` is best-effort observability and must not block session
  issuance.
- Browser-visible failures are not silently dropped: attendee start errors and
  completion retry states surface through `GamePage`, and admin API failures
  throw user-facing messages consumed by the admin dashboard state.
- Live-event operator path is now documented in
  [operations.md — Live Monitoring And Log Triage](./operations.md#live-monitoring-and-log-triage):
  check the latest `Production Admin Smoke` workflow result first; inspect
  Vercel deployment/runtime logs for frontend route availability; inspect
  Supabase Edge Function logs for `issue-session`, `complete-quiz`,
  `save-draft`, `publish-draft`, and `unpublish-event`; then verify Supabase
  table activity in `quiz_starts`, `quiz_completions`, and
  `raffle_entitlements` for the event.
- Analytics-critical data is present in code and local validation:
  `issue-session` records `quiz_starts`, and completions/entitlements are
  persisted through the trusted RPC. Production promotion evidence exists from
  release workflow run `24537097693` on commit `d08f65e`, which already included
  the starts migrations; `70977d6` was docs-only and its release job was
  skipped.
- Production admin smoke is now operational for this branch: GitHub run
  `24541137250` passed after the GitHub `production` environment settings and
  smoke fixture defaults were aligned.

**Cleanliness:**

- Dimension 4 audit completed for largest source files, architecture guardrails,
  and database enforcement behind public/origin-gated writes.
- Largest `.ts`/`.tsx` source files in the audited areas are currently:
  `questionBuilder.ts` (467), `useSelectedDraft.ts` (443),
  `AdminQuestionEditor.tsx` (438), `AdminEventWorkspace.tsx` (397),
  `draft-content.ts` (358), `quizApi.ts` (321), `useAdminDashboard.ts`
  (306), `quizSessionState.ts` (275), `publish-draft/index.ts` (263),
  `sample-games.ts` (256), and `adminQuizApi.ts` (234).
- Existing refactor checklist coverage already tracks `questionBuilder.ts`,
  `AdminQuestionEditor.tsx`, `AdminEventWorkspace.tsx`,
  `draft-content.ts`, `quizApi.ts`, `useAdminDashboard.ts`,
  `sample-games.ts`, and `adminQuizApi.ts` where appropriate.
- New follow-up opened in [code-refactor-checklist.md](./code-refactor-checklist.md):
  split selected draft publish/unpublish state from draft loading and save
  state in `apps/web/src/admin/useSelectedDraft.ts`.
- Architecture guardrails still hold at the reviewed boundaries: visual/admin
  interaction logic remains in `apps/web/src`, shared quiz validation/scoring
  remains in `shared/game-config`, and trust/session/persistence/entitlement
  writes remain in `supabase/functions` plus `supabase/migrations`.
- Public or origin-gated backend writes have DB-level enforcement: completion
  writes go through `complete_quiz_and_award_entitlement` with unique
  request/attempt and one-entitlement constraints; `quiz_starts` has a unique
  `(event_id, client_session_id)` pair plus an event FK; draft writes have
  primary-key/slug constraints plus the slug-lock trigger; publish/unpublish go
  through transactional RPCs with audit rows and published-content constraints.

**Efficiency:**

- Dimension 5 audit completed for attendee network/state flow, Edge Function
  hot paths, database query/index coverage, and build output.
- Bundle baseline from `npm run validate:local` / `npm run build:web`:
  `dist/assets/index-DYmuva_Y.js` 459.21 kB / gzip 128.82 kB, and
  `dist/assets/index-BqpJ_O73.css` 13.21 kB / gzip 3.57 kB. This is the first
  recorded release-readiness bundle measurement, so there is no prior-pass
  trend comparison yet.
- Attendee path does not show redundant completion writes: `useQuizSession`
  guards completion submission by `completionRequestId`, retry reuses the same
  request id, and `quizApi` performs at most one session re-bootstrap after a
  401 before replaying the same completion request.
- Edge Function hot paths are appropriately narrow for the MVP: session
  issuance performs one best-effort start upsert after session verification;
  completion loads the published event and parallel question/option rows, then
  persists through one RPC; publish/unpublish route through transactional RPCs.
- Database query paths have suitable constraints/indexes for hundreds of
  attendees per event: route lookups use unique `quiz_events.slug`, published
  content reads use `event_id`-leading primary keys, completions and
  entitlements use `(event_id, client_session_id)` indexes/constraints, and
  `quiz_starts` uses unique `(event_id, client_session_id)` plus an event FK.
- No new performance follow-up opened in this pass.

**Release-blocking open questions:**

- Dimension 6 audit completed against [open-questions.md](./open-questions.md)
  and `decision` entries in [backlog.md](./backlog.md).
- Release-blocking question resolved after the pass: for the Madrona pre-launch
  release milestone, the current completion screen plus verification code is
  sufficient for volunteer raffle handoff. Stronger proof treatment is deferred
  until after this release.
- Not release-blocking for this target: QR entry route. `experience.md`
  already says QR codes should open directly into the event quiz experience,
  and `/game/:slug` exists for that purpose; the long-term question of whether
  this should always be the production entry contract remains open in
  [open-questions.md](./open-questions.md).
- Not release-blocking for this target, deferred as tracked follow-ups:
  staging/branch Supabase promotion path, sponsor reporting requirements,
  organizer roles/root admin UI, richer publish controls, multi-quiz events,
  and stronger trust-boundary/abuse controls.

**Go/no-go:** no-go — PR CI evidence is still pending for this branch.

**Follow-ups opened:**

- Resolved after pass: production admin smoke settings were configured and
  `Production Admin Smoke` run `24541137250` passed on the release-readiness
  branch.
- Resolved after pass: volunteer verification affordance for Madrona recorded in
  [backlog.md](./backlog.md) and [open-questions.md](./open-questions.md).
- Refactor candidate: split selected draft publish/unpublish state from draft
  loading and save state in [code-refactor-checklist.md](./code-refactor-checklist.md).

## Related Docs

- [AGENTS.md](../AGENTS.md) — agent behavior, pre-edit gate, doc currency PR gate, validation honesty rules
- [dev.md](./dev.md) — contributor workflow source of truth
- [testing.md](./testing.md) — test strategy, coverage snapshot, testing todo list
- [backlog.md](./backlog.md) — priority-ordered follow-up across all concerns
- [open-questions.md](./open-questions.md) — unresolved decisions
- [code-refactor-checklist.md](./code-refactor-checklist.md) — behavior-preserving refactor candidates
- [documentation-quality-checklist.md](./documentation-quality-checklist.md) — docs maintenance checklist
- [analytics-strategy.md](./analytics-strategy.md) — analytics and the only current telemetry surface
- [operations.md](./operations.md) — platform-managed settings
- [production-admin-smoke-tracking.md](./production-admin-smoke-tracking.md) — post-release smoke coverage and triage
