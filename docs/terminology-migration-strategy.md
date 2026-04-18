# Terminology Migration Strategy (`quiz`/`raffle` → `game`/`entitlement`)

## Purpose

Define a practical, low-risk migration plan to move product, API, code, and data
language from quiz/raffle-centric naming to more generic game/entitlement naming
before launch hardens contracts and creates long-term confusion.

This document is the tracking source of truth for the Tier 1 backlog decision:
**Terminology migration strategy (`quiz`/`raffle` → `game`/`entitlement`)**.

## Why this migration is being done now

The codebase currently mixes two naming systems:

- **Generic names** in some runtime surfaces (for example `GameConfig` and
  `apps/web/src/game/`)
- **Legacy/specific names** in remaining frontend and documentation surfaces
  (`/game/:slug` route paired with frontend modules such as `quizApi.ts` and
  `useQuizSession`)

That mixed vocabulary is acceptable during rapid MVP build-out, but it creates
increasing cost as we add redemption, reporting, and future non-quiz
experiences.

Doing this migration now is cheaper and safer because:

1. There is **no production data to preserve**, so schema and contract renames
   can be first-class rather than indefinitely aliased.
2. We are still pre-launch, so we can realign names before external consumers,
   dashboards, and operational playbooks depend on legacy terms.
3. The architecture already points toward broader event experiences, making
   generic naming the better long-term default for maintainability and
   extensibility.

## Current-state naming inventory (impact surface)

The terminology appears across multiple system layers:

- **Frontend/public routes and API clients**
  - `/game/:slug` route already uses generic `game` naming
  - `quizApi.ts`, `quizContentApi.ts`, and `types/quiz.ts` still expose quiz
    terms
- **Shared runtime and domain model**
  - `shared/game-config.ts` and `GameConfig` are already generic
  - quiz-specific helper naming still exists around scoring/flow
- **Edge Functions and contracts**
  - `complete-game`, `issue-session`, `save-draft`, `publish-draft`,
    `unpublish-event`
  - trusted completion response fields now use entitlement terminology
- **Database schema and SQL functions**
  - `quiz_events`, `quiz_questions`, `quiz_completions`, `quiz_starts`,
    `quiz_admin_users`, `raffle_entitlements`, and `is_quiz_admin()`
- **Documentation and operational language**
  - architecture, testing, analytics, product/experience docs and runbooks use
    mixed terminology

## Constraints and assumptions

- **No backwards-compatibility requirement for production data**
  (explicit task input).
- Existing **test/demo events must be migrated** as part of rollout.
- Functionality must remain equivalent (behavior-preserving terminology change,
  not a product-behavior rewrite).
- Migration should be split into launchable phases; each phase must produce a
  demonstrable, testable improvement.

## Decision alternatives

### Alternative A — Big-bang rename in one release window

Rename all relevant frontend/backend/schema/docs surfaces in one branch and one
release.

**Impact of decision**

- Fastest path to a fully consistent vocabulary.
- Highest blast radius and hardest review, rollback, and defect isolation.

**Pros**

- One-time migration event.
- Avoids temporary dual naming.
- Documentation can be updated once.

**Cons**

- Very large PR(s) with mixed concerns (SQL, functions, UI, docs).
- High chance of missing one contract surface.
- Hard to attribute regressions quickly.

**Assessment**: Not recommended for this repo stage; risk and review complexity
outweigh speed.

---

### Alternative B — Per-layer migration with temporary compatibility aliases

Migrate one layer at a time (docs/UI/API/schema), keeping temporary aliases
(synonym SQL views/functions, duplicate API response fields, dual route helpers)
throughout transition.

**Impact of decision**

- Safer incremental rollout, but introduces temporary naming duplication.

**Pros**

- Smaller PRs and clearer review boundaries.
- Easier rollback at each step.
- Can validate each layer independently.

**Cons**

- Extra implementation and cleanup effort for aliases.
- Terminology remains mixed longer.
- Risk of compatibility shims becoming permanent debt.

**Assessment**: Viable, but not ideal given no production compatibility need.

---

### Alternative C — Phase-based direct rename (no long-lived compatibility)

Use phased, reviewable PR slices, but each slice directly adopts target naming
without preserving legacy public contracts beyond short in-branch transition
work.

**Impact of decision**

- Balances low risk (small phased rollout) with low long-term maintenance
  burden (no enduring alias layer).

**Pros**

- Keeps changes reviewable and testable by layer/phase.
- Avoids permanent compatibility complexity.
- Matches stated constraint: no production data/back-compat requirement.

**Cons**

- Requires disciplined sequencing so dependent layers do not break.
- Some short-lived branch-level churn while dependent PRs land.

**Assessment**: **Recommended**.

## Recommendation

Adopt **Alternative C: phase-based direct rename**.

Rationale:

- It preserves delivery safety by staging risk.
- It avoids wasting effort on compatibility scaffolding we do not need.
- It reaches a clean end-state quickly, with no ambiguous “old-vs-new”
  contract debt.

## Target terminology end-state

Use this vocabulary consistently across code, contracts, schema, and docs:

- `quiz` → `game` where the concept is the attendee experience/content unit.
- `raffle` → `entitlement` where the concept is earned reward eligibility.
- `quiz admin` naming should move to `game admin` (or broader event-ops role
  naming if a role decision lands first).
- Function, table, type, and RPC names should prefer concept-oriented naming
  over MVP-specific campaign language.

## Phased implementation and launch plan

Each phase can contain multiple PRs, but should stay launchable and verifiable.

### Phase 0 — Discovery, contract map, and naming spec

**Goal**: produce a complete migration map and non-negotiable naming rules
before refactors.

**Scope**

- Build an inventory matrix of all impacted names in:
  - frontend routes/types/api modules
  - shared runtime modules
  - edge functions
  - SQL tables/functions/policies/views
  - tests/fixtures/scripts/docs
- Define canonical replacements and prohibited legacy names for new code.
- Identify order dependencies (for example, DB rename preconditions for edge
  function updates).
- Decide whether `event-code-prerequisite-plan` migrations land before or after
  Phase 2, and document the ordering as a binding phase constraint.
- Finalize canonical name for the top-level published entity table
  (`game_events` vs `games`) so Phase 2 migrations use the decided name.

**Demonstrable launch difference**

- Team has a signed-off migration map and phase checklist that prevents
  accidental mixed naming.

**Validation gate**

- Manual review: every Tier 1 architecture/runtime surface has an explicit
  mapping row.

**Status: complete** — see `terminology-migration-map.md`.

---

### Phase 1 — Documentation and product-language alignment (no runtime renames yet)

**Goal**: align docs and reviewer vocabulary so implementation phases are
unambiguous.

**Scope**

- Update architecture/product/experience/testing docs to state target
  terminology and migration intent.
- Add short glossary guidance for contributors.
- Mark backlog status from “decision pending” to “decision made, migration in
  progress.”

**Demonstrable launch difference**

- Contributors and reviewers use the same language before touching runtime
  contracts.

**Validation gate**

- Docs review pass confirms no contradictory terminology guidance in core docs.

---

### Phase 2 — Database and SQL contract migration

**Status: complete** — migration
`20260418000000_rename_database_terminology_to_game.sql` renames the persistent
schema, SQL functions, RLS policies, constraints, indexes, SQL tests, and direct
backend DB call sites to the target names.

**Goal**: move persistence layer names to target terminology and migrate seeded
(test/demo) data.

**Scope**

- Create migrations to rename core tables/functions/constraints/indexes from
  `quiz_*`/`raffle_*` to `game_*`/`entitlement_*` equivalents.
- Update RLS policies and helper function names (for example
  `is_quiz_admin` → renamed equivalent).
- Ensure all seed/demo/test data paths use new table names.
- Remove temporary references to old table/function names in SQL code paths.

**Demonstrable launch difference**

- Supabase schema and SQL API now communicate domain intent with generic names.

**Validation gate**

- Local migration reset + tests pass with only new schema names.
- Explicit verification that seeded test events and redemption-relevant records
  still function.
- Regenerate Supabase TypeScript types (`supabase gen types typescript`) and
  verify no stale `quiz_*`/`raffle_*` identifiers remain in the generated
  output before Phase 3 begins.

---

### Phase 3 — Edge Function and shared-contract rename

**Status: complete in this branch** — the trusted completion endpoint/module is
now `complete-game`, the function handler/dependency exports use
`CompleteGame...` naming, the completion response exposes
`entitlementEligible`, and the shared published/authoring game model uses
`entitlementLabel`. Migration
`20260418010000_rename_authoring_entitlement_label_json.sql` backfills existing
authoring JSON and updates the publish projection to read `entitlementLabel`.

**Goal**: align backend runtime interfaces to new terminology.

**Scope**

- Rename function modules/endpoints/contracts (`complete-quiz` naming,
  payload/result types, helper identifiers).
- Update shared runtime naming where contracts still expose legacy terms.
- Keep behavior unchanged while swapping identifiers and user-facing error copy
  as needed.

**Demonstrable launch difference**

- Backend APIs, logs, and typed contracts consistently use game/entitlement
  naming.

**Validation gate**

- `deno check` and function tests pass against renamed DB contracts.
- Trusted completion + redemption paths verified in integration/smoke flow.

---

### Phase 4 — Frontend route/module/type/copy migration

**Goal**: remove remaining legacy terminology from the attendee/admin web app.

**Scope**

- Rename frontend API modules/types/hooks still named around quiz/raffle.
- Update user-visible copy to preferred language where product-approved.
- Migrate test fixtures and UI tests to renamed contracts.

**Demonstrable launch difference**

- UI and frontend codebase speak one coherent domain vocabulary.

**Validation gate**

- `npm run lint`, `npm test`, `npm run build:web` pass.
- Mobile-first smoke and key route loading still pass.

---

### Phase 5 — Cleanup, guardrails, and closure

**Goal**: prevent regression into mixed naming and close backlog decision.

**Scope**

- Remove any temporary migration notes and stale references.
- Add guardrails to prevent regression into legacy naming:
  - ESLint `no-restricted-syntax` rule banning identifiers matching
    `quiz_`/`raffle_` prefixes in `apps/` and `shared/`.
  - CI grep gate: `grep -r "quiz_\|raffle_" supabase/migrations/ apps/ shared/ --include="*.ts"`
    fails on any non-historical match (gate can allowlist existing migration
    file names that are intentional historical references).
- Final docs sweep and backlog updates.

**Demonstrable launch difference**

- Migration is complete, enforceable in review, and reflected in all core docs.

**Validation gate**

- Final repo-wide terminology scan shows only intentional historical mentions
  (e.g., migration notes).

## PR slicing guidance inside phases

Recommended PR boundaries (illustrative):

1. Planning/spec PR (this document + backlog status wiring)
2. DB rename PR(s)
3. Edge function + shared contract PR(s)
4. Frontend rename PR(s)
5. Cleanup/guardrail PR

Keep each PR behavior-preserving and focused on one ownership layer where
possible.

## Test and validation strategy by phase

- **Documentation-only phases (0/1/5 docs updates):** doc review + targeted
  terminology scans.
- **Backend phases (2/3):** run SQL migration/reset path, function checks, and
  backend tests.
- **Frontend phases (4):** run lint, unit/integration tests, web build, and
  attendee smoke flow.
- **Cross-layer checkpoints:** run full repo validation set before closing a
  phase that changes both backend and frontend contracts.

## Risks and mitigations

1. **Risk: missed identifier causes runtime break.**
   - Mitigation: enforce inventory matrix and phase-specific grep checks before
     merge.
2. **Risk: migration PR scope creep.**
   - Mitigation: keep layer boundaries strict; defer opportunistic cleanup.
3. **Risk: docs drift during multi-phase rollout.**
   - Mitigation: require doc updates in each phase PR; treat doc currency as a
     gate.
4. **Risk: test data drift after SQL renames.**
   - Mitigation: explicitly migrate and validate seed/demo event fixtures in
     Phase 2.

## Open questions

Resolve questions 2–4 before Phase 2 starts. Question 1 is a Phase 4 blocker
only (frontend concern; does not affect DB or edge function work).

1. ~~**Naming decision for attendee route shape**~~ **DECIDED**
   - Adopt `/event/:slug/game`. Cost is low: only `routes.ts` (type, prefix,
     builder, matcher) and `vercel.json` require changes; all 7 link sites
     already use `routes.game()` and need no edits. Execute in Phase 4.
2. ~~**Role naming convergence timing**~~ **DECIDED**
   - Rename `is_quiz_admin()` → `is_admin()` in Phase 2. "Admin" is the global
     platform role; no qualifier needed. The future organizer role (event-scoped)
     will get its own separate function and does not conflict with this name.
3. ~~**Analytics naming migration scope**~~ **DECIDED**
   - Rename `quiz_starts` → `game_starts` in Phase 2 along with all other DB
     artifacts. No live analytics consumers exist, so no breakage risk. The FK
     to `quiz_events` is already in Phase 2 scope regardless.
4. ~~**Historical docs policy**~~ **DECIDED**
   - Rewrite docs to use current names. Where a doc references an immutable
     artifact by its original name (e.g., a migration filename), add a short
     inline note. No repo-wide glossary.

## Contributor naming reference

Use these terms in new code, docs, and PR descriptions. The old terms appear
only as immutable migration filenames or as the "before" side of this document.

| Concept | Use this | Not this |
|---|---|---|
| Published event content table | `game_events` | `quiz_events` |
| Questions table | `game_questions` | `quiz_questions` |
| Question options table | `game_question_options` | `quiz_question_options` |
| Completion record table | `game_completions` | `quiz_completions` |
| Session start tracking table | `game_starts` | `quiz_starts` |
| Reward/prize record table | `game_entitlements` | `raffle_entitlements` |
| Admin allowlist table | `admin_users` | `quiz_admin_users` |
| Auth check SQL function | `is_admin()` | `is_quiz_admin()` |
| Trusted completion function | `complete-game` | `complete-quiz` |
| Browser game API module | `gameApi.ts` | `quizApi.ts` |
| Browser admin API module | `adminGameApi.ts` | `adminQuizApi.ts` |
| Published content API module | `gameContentApi.ts` | `quizContentApi.ts` |
| Session hook | `useGameSession` | `useQuizSession` |
| Session state module | `gameSessionState.ts` | `quizSessionState.ts` |
| In-memory runtime model | `GameConfig` (unchanged) | — |
| Publish draft RPC | `publish_game_event_draft` | `publish_quiz_event_draft` |
| Field: prize/reward label | `entitlement_label` | `raffle_label` |

Migration filenames (e.g. `20260403120000_complete_quiz_entitlements.sql`) are
immutable historical artifacts and intentionally preserve original names.

---

## Exit criteria

This strategy is complete when:

- backlog decision item is marked complete with links to landed phase PRs,
- core runtime (frontend/shared/functions/schema) uses target terminology
  consistently,
- test/demo events and redemption-relevant flows function on renamed contracts,
- core docs and contributor workflow references are updated to target terms,
- no non-historical `quiz_`/`raffle_` contract identifiers remain.
