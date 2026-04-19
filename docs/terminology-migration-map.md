# Terminology Migration Map

Phase 0 deliverable for the `quiz`/`raffle` → `game`/`entitlement` migration.
Canonical reference for all rename targets, no-change zones, order dependencies,
and naming rules. See `terminology-migration-strategy.md` for the phased plan.

## Phase 0 decisions

**Event-code sequencing**: Phase 2 (DB rename) runs first. The
`event-code-prerequisite-plan.md` now uses target database names directly, so
the event-code prerequisite can be implemented against the renamed schema.

**Top-level published entity table**: `game_events` (not `games`). The "event"
qualifier is semantically load-bearing — the entity is a live published instance
with a slug, location, and publish date, not an abstract game definition. Child
tables follow the same `game_event_*` convention.

---

## Database layer (Phase 2)

**Implementation status:** complete in migration
`20260418000000_rename_database_terminology_to_game.sql`. Historical migration
filenames still contain the original words where they were created before this
rename.

### Tables

| Old name | New name |
|----------|----------|
| `quiz_events` | `game_events` |
| `quiz_questions` | `game_questions` |
| `quiz_question_options` | `game_question_options` |
| `quiz_completions` | `game_completions` |
| `raffle_entitlements` | `game_entitlements` |
| `quiz_event_drafts` | `game_event_drafts` |
| `quiz_event_versions` | `game_event_versions` |
| `quiz_admin_users` | `admin_users` |
| `quiz_event_audit_log` | `game_event_audit_log` |
| `quiz_starts` | `game_starts` |

### Columns

| Table (new name) | Old column | New column |
|-----------------|------------|------------|
| `game_events` | `raffle_label` | `entitlement_label` |

All other columns retain their names. (`entitlement_awarded` and `entitlement_id`
in `game_completions` are already correct.)

### SQL functions

| Old name | New name |
|----------|----------|
| `is_quiz_admin()` | `is_admin()` |
| `complete_quiz_and_award_entitlement()` | `complete_game_and_award_entitlement()` |
| `publish_quiz_event_draft()` | `publish_game_event_draft()` |
| `unpublish_quiz_event()` | `unpublish_game_event()` |
| `set_quiz_event_draft_audit_fields()` | `set_game_event_draft_audit_fields()` |
| `enforce_quiz_event_draft_slug_lock()` | `enforce_game_event_draft_slug_lock()` |

No change: `generate_neighborly_verification_code()`, `current_request_email()`,
`current_request_user_id()`.

### Triggers

| Old name | New name |
|----------|----------|
| `set_quiz_event_draft_audit_fields` (trigger) | `set_game_event_draft_audit_fields` |
| `quiz_event_draft_slug_lock` (trigger) | `game_event_draft_slug_lock` |

### RLS policies

| Old name | New name |
|----------|----------|
| `published quiz events are readable` | `published game events are readable` |
| `published quiz questions are readable` | `published game questions are readable` |
| `published quiz options are readable` | `published game options are readable` |
| `quiz admins can read/insert/update/delete drafts` | `admins can read/insert/update/delete drafts` |
| `quiz admins can read versions` | `admins can read versions` |

### Constraints and indexes

All constraints and indexes named with `quiz_` or `raffle_` prefixes get renamed
to `game_` equivalents in the Phase 2 migration. Pattern: replace leading
`quiz_` → `game_` and `raffle_` → `game_`. No semantic content changes.

---

## Edge functions (Phase 3)

**Implementation status:** complete in this branch. The trusted completion
function directory, endpoint URL, handler/dependency exports, local integration
helpers, Supabase config, and CI Deno check now use `complete-game`.

### Function directory names and HTTP endpoints

| Old | New |
|-----|-----|
| `complete-quiz` / `/functions/v1/complete-quiz` | `complete-game` / `/functions/v1/complete-game` |

No change: `issue-session`, `publish-draft`, `save-draft`, `unpublish-event`.

### TypeScript types inside edge functions

| Old name | New name |
|----------|----------|
| `CompleteQuizHandlerDependencies` | `CompleteGameHandlerDependencies` |

All other edge function types (`CompletionPersistenceInput`,
`CompletionPersistenceResult`, `CompletionRpcRow`, `DraftContentRow`,
`PublishRpcRow`, `DraftSaveRow`, etc.) are already generic — no change.

### RPC call sites

| Old call | New call |
|----------|----------|
| `.rpc('complete_quiz_and_award_entitlement', ...)` | `.rpc('complete_game_and_award_entitlement', ...)` |
| `.rpc('publish_quiz_event_draft', ...)` | `.rpc('publish_game_event_draft', ...)` |
| `.rpc('unpublish_quiz_event', ...)` | `.rpc('unpublish_game_event', ...)` |

### Table references in function code

All `quiz_*`/`raffle_*` table name strings used in PostgREST or SQL queries
within edge functions get updated to match the Phase 2 DB renames.

---

## Shared modules (Phase 3)

**Implementation status:** complete in this branch. `shared/game-config/` uses
the target runtime field `GameConfig.entitlementLabel`, published row field
`PublishedGameEventRow.entitlement_label`, and authoring draft JSON field
`AuthoringGameDraftContent.entitlementLabel`.

Migration `20260418010000_rename_authoring_entitlement_label_json.sql` backfills
existing draft/version JSON from `raffleLabel` to `entitlementLabel` and updates
`publish_game_event_draft()` so the target draft key projects into
`game_events.entitlement_label`.

---

## Frontend (Phase 4)

**Implementation status:** complete in this branch. Frontend modules, exports,
style partials, route helpers, web copy, frontend tests, Playwright route
expectations, UI review helpers, and production/admin smoke helpers now use the
target Phase 4 naming. Migration
`20260418020000_update_demo_game_copy.sql` keeps seeded database demo content in
sync with the frontend fixture copy used by trusted-backend browser tests.

### File renames

| Old file | New file |
|----------|----------|
| `apps/web/src/lib/quizApi.ts` | `apps/web/src/lib/gameApi.ts` |
| `apps/web/src/lib/quizContentApi.ts` | `apps/web/src/lib/gameContentApi.ts` |
| `apps/web/src/lib/adminQuizApi.ts` | `apps/web/src/lib/adminGameApi.ts` |
| `apps/web/src/types/quiz.ts` | `apps/web/src/types/game.ts` |
| `apps/web/src/game/quizSessionState.ts` | `apps/web/src/game/gameSessionState.ts` |
| `apps/web/src/game/quizSessionSelectors.ts` | `apps/web/src/game/gameSessionSelectors.ts` |
| `apps/web/src/game/quizUtils.ts` | `apps/web/src/game/gameUtils.ts` |

### Type and interface renames

| Old name | New name |
|----------|----------|
| `QuizPhase` | `GamePhase` |
| `QuizState` | `GameState` |
| `QuizAction` | `GameAction` |
| `QuizSessionViewState` | `GameSessionViewState` |
| `QuizCompletionResult` | `GameCompletionResult` |
| `QuizCompletionEntitlement` | `GameCompletionEntitlement` |
| `SubmitQuizCompletionInput` | `SubmitGameCompletionInput` |

### Function and hook renames

| Old name | New name |
|----------|----------|
| `createQuizState()` | `createGameState()` |
| `quizReducer()` | `gameReducer()` |
| `getQuizSessionScore()` | `getGameSessionScore()` |
| `getQuizSessionViewState()` | `getGameSessionViewState()` |
| `submitQuizCompletion()` | `submitGameCompletion()` |
| `submitQuizCompletionToSupabase()` | `submitGameCompletionToSupabase()` |
| `useQuizSession` | `useGameSession` |

No change: `createCompletionRequestId()`, `buildLocalCompletionResult()`,
`ensureServerSession()`, `listPublishedGameSummaries()`,
`loadPublishedGameBySlug()`.

### API payload fields

**Implementation status:** complete in Phase 3 for the trusted completion
response. Phase 4 completed the frontend file/type renames while preserving the
Phase 3 `entitlementEligible` data shape.

| Old field | New field |
|-----------|-----------|
| `raffle_eligible` / `raffleEligible` | `entitlement_eligible` / `entitlementEligible` |

### Route change (Phase 4)

| Old route | New route |
|-----------|-----------|
| `/game/:slug` | `/event/:slug/game` |

Implemented in `routes.ts` and `apps/web/vercel.json`. Call sites continue to
use `routes.game()`, which now builds `/event/:slug/game`; `matchGamePath()`
accepts only the new route.

### No-change zones in frontend

`apps/web/src/game/` directory name, `GamePage`, `GameRoutePage`,
`GameCompletionPanel`, `GameIntroPanel`, `CurrentQuestionPanel`,
`CorrectAnswerPanel`, `GameIntroPanel` — all already use target terminology.

---

## Tests

### TypeScript test file renames (Phase 4)

| Old file | New file |
|----------|----------|
| `tests/web/game/quizSessionState.test.ts` | `tests/web/game/gameSessionState.test.ts` |
| `tests/web/game/quizSessionSelectors.test.ts` | `tests/web/game/gameSessionSelectors.test.ts` |
| `tests/web/game/quizUtils.test.ts` | `tests/web/game/gameUtils.test.ts` |
| `tests/web/game/useQuizSession.test.ts` | `tests/web/game/useGameSession.test.ts` |
| `tests/web/lib/quizApi.test.ts` | `tests/web/lib/gameApi.test.ts` |
| `tests/web/lib/adminQuizApi.test.ts` | `tests/web/lib/adminGameApi.test.ts` |

### SQL test file renames (Phase 2)

SQL test filenames are renamed to match the renamed DB artifacts they test.
Internal table/function references update to match Phase 2 renames.

| Old file | New file |
|----------|----------|
| `supabase/tests/database/complete_quiz_and_award_entitlement.test.sql` | `complete_game_and_award_entitlement.test.sql` |
| `supabase/tests/database/published_quiz_content.test.sql` | `published_game_content.test.sql` |
| `supabase/tests/database/quiz_authoring_phase2_auth.test.sql` | `game_authoring_phase2_auth.test.sql` |
| `supabase/tests/database/quiz_authoring_phase3_publish_projection.test.sql` | `game_authoring_phase3_publish_projection.test.sql` |
| `supabase/tests/database/quiz_authoring_phase3_publish_failure_permissions.test.sql` | `game_authoring_phase3_publish_failure_permissions.test.sql` |
| `supabase/tests/database/quiz_authoring_phase3_unpublish_audit.test.sql` | `game_authoring_phase3_unpublish_audit.test.sql` |
| `supabase/tests/database/quiz_authoring_phase5_1_invariants.test.sql` | `game_authoring_phase5_1_invariants.test.sql` |

### No-change test files

Function-level test files whose names don't contain `quiz`/`raffle` need only
internal reference updates (table names, type imports): `issue-session.test.ts`,
`publish-draft.test.ts`, `save-draft.test.ts`, `unpublish-event.test.ts`,
`cors.test.ts`, and all `shared/game-config/*.test.ts` files.

---

## Documentation (Phase 1 and Phase 5)

**Implementation status:** complete for runtime and core contributor docs. Phase
1 aligned active contributor docs; Phase 5 corrected stale references in
`continuous-deployment-plan.md` and `code-refactor-checklist.md`. Two heavy
plan docs still contain legacy terminology and are tracked as a follow-up in
`docs/backlog.md`:

- `docs/database-backed-quiz-content.md` — 12 occurrences remaining
- `docs/quiz-authoring-plan.md` — 27 occurrences remaining

The following docs were confirmed clean across Phase 1 and Phase 5:

- `docs/architecture.md`
- `docs/product.md`
- `docs/experience.md`
- `docs/testing.md`
- `docs/dev.md`
- `docs/operations.md`
- `docs/release-readiness.md`
- `docs/backlog.md`
- `docs/analytics-strategy.md`
- `docs/security-and-abuse-plan.md`
- `docs/reward-redemption-mvp-design.md`
- `docs/production-admin-smoke-tracking.md`
- `docs/event-code-prerequisite-plan.md` (rewrite to target names before implementation)
- `docs/code-documentation-audit.md`
- `docs/code-refactor-checklist.md`
- `docs/README.md`
- `docs/documentation-quality-checklist.md`

Policy (per Q4 decision): rewrite to current names; add inline notes only where
an immutable artifact name (e.g., a migration filename) must be cited verbatim.

---

## Order dependencies

These constraints must be respected across phases:

1. **Phase 2 before Phase 3**: edge functions reference DB table names and RPC
   names directly. DB renames must land and Supabase TypeScript types must be
   regenerated before edge function code is updated.

2. **Phase 3 before Phase 4**: Phase 3 moved the backend endpoint and shared
   contract first. Phase 4 then renamed frontend modules/routes/copy without
   changing the backend contract again.

3. **`complete_game_and_award_entitlement` RPC rename (Phase 2) before
   `complete-game` edge function rename (Phase 3)**: the function's
   `persistence.ts` calls the RPC by name.

4. **`raffle_label` → `entitlement_label` column rename (Phase 2) before
   `GameConfig.raffleLabel` → `entitlementLabel` field rename (Phase 3/shared)**:
   the DB column and the TypeScript field must be updated together or in strict
   DB-first order.

5. **event-code-prerequisite-plan rewrite before Phase 2 starts**: the plan
   must use target table names so its migrations land cleanly on the renamed
   schema.

---

## Naming rules for new code (effective immediately)

These apply to all new code from this point forward, before migrations land:

- **Prohibited in new identifiers**: `quiz_`, `raffle_`, `Quiz` (as a
  domain concept), `Raffle`.
- **Required for new identifiers**: use `game_`, `Game`, `entitlement_`,
  `Entitlement` equivalents.
- **Admin role**: new functions and policies use `is_admin()` / `admin`; never
  `quiz_admin` or `game_admin`.
- **Exception**: migration filenames are immutable after creation; new
  migrations use target names from the start.
