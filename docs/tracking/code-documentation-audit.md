# Code Documentation Audit (2026-04-17)

## Purpose

This document is the canonical output for the Tier 5 backlog item:
`Audit file-level TSDoc/JSDoc and inline code-documentation gaps`.

This pass is audit-only.

- No implementation code comments were edited in this change.
- Findings are classified as `Required`, `Optional`, or `Noise`.
- Remediation is split into PR-sized follow-up slices with explicit validation commands.

## Scope

Audited directories:

- `shared/game-config`
- `apps/web/src/lib`
- `apps/web/src/admin`
- `apps/web/src/game`
- `supabase/functions`
- `supabase/migrations`

Total audited files: 66 (`.ts`, `.tsx`, `.sql`).

## Rubric

Classification rules for this pass:

- `Required`
  Needed to satisfy `docs/dev.md` code-documentation standard and
  `docs/plans/release-readiness.md` Dimension 2 release bar at a durable boundary.
  Typical cases: large route/orchestration/boundary modules with unclear ownership,
  exported seams at trust/persistence/API boundaries, and non-obvious SQL
  invariants.
- `Optional`
  Helpful clarity improvements that are not currently required to meet the
  project standard.
- `Noise`
  Explicitly avoid adding comments. Names, types, and structure already explain
  behavior.

## Inventory Method

Commands used:

```bash
find shared/game-config apps/web/src/lib apps/web/src/admin apps/web/src/game supabase/functions supabase/migrations -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.sql' \) | sort
find shared/game-config apps/web/src/lib apps/web/src/admin apps/web/src/game supabase/functions supabase/migrations -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.sql' \) -print0 | xargs -0 wc -l | sort -nr | head -n 20
```

## Audited Inventory

### `apps/web/src/admin` (16)

- `apps/web/src/admin/AdminDashboardContent.tsx`
- `apps/web/src/admin/AdminEventDetailsForm.tsx`
- `apps/web/src/admin/AdminEventWorkspace.tsx`
- `apps/web/src/admin/AdminPageShell.tsx`
- `apps/web/src/admin/AdminPublishPanel.tsx`
- `apps/web/src/admin/AdminQuestionEditor.tsx`
- `apps/web/src/admin/AdminSignInForm.tsx`
- `apps/web/src/admin/draftCreation.ts`
- `apps/web/src/admin/eventDetails.ts`
- `apps/web/src/admin/publishChecklist.ts`
- `apps/web/src/admin/questionBuilder.ts`
- `apps/web/src/admin/questionFormMapping.ts`
- `apps/web/src/admin/questionStructure.ts`
- `apps/web/src/admin/useAdminDashboard.ts`
- `apps/web/src/admin/useAdminSession.ts`
- `apps/web/src/admin/useSelectedDraft.ts`

### `apps/web/src/game` (8)

- `apps/web/src/game/components/CorrectAnswerPanel.tsx`
- `apps/web/src/game/components/CurrentQuestionPanel.tsx`
- `apps/web/src/game/components/GameCompletionPanel.tsx`
- `apps/web/src/game/components/GameIntroPanel.tsx`
- `apps/web/src/game/gameSessionSelectors.ts`
- `apps/web/src/game/gameSessionState.ts`
- `apps/web/src/game/gameUtils.ts`
- `apps/web/src/game/useGameSession.ts`

### `apps/web/src/lib` (5)

- `apps/web/src/lib/adminGameApi.ts`
- `apps/web/src/lib/gameApi.ts`
- `apps/web/src/lib/gameContentApi.ts`
- `apps/web/src/lib/session.ts`
- `apps/web/src/lib/supabaseBrowser.ts`

### `shared/game-config` (11)

- `shared/game-config/answers.ts`
- `shared/game-config/catalog.ts`
- `shared/game-config/constants.ts`
- `shared/game-config/db-content.ts`
- `shared/game-config/draft-content.ts`
- `shared/game-config/draft-json.ts`
- `shared/game-config/draft-question-parsing.ts`
- `shared/game-config/game-validation.ts`
- `shared/game-config/index.ts`
- `shared/game-config/sample-fixtures.ts`
- `shared/game-config/sample-games.ts`

### `supabase/functions` (15)

- `supabase/functions/_shared/admin-auth.ts`
- `supabase/functions/_shared/authoring-http.ts`
- `supabase/functions/_shared/cors.ts`
- `supabase/functions/_shared/published-game-loader.ts`
- `supabase/functions/_shared/session-cookie.ts`
- `supabase/functions/complete-game/dependencies.ts`
- `supabase/functions/complete-game/index.ts`
- `supabase/functions/complete-game/payload.ts`
- `supabase/functions/complete-game/persistence.ts`
- `supabase/functions/complete-game/response.ts`
- `supabase/functions/issue-session/index.ts`
- `supabase/functions/publish-draft/index.ts`
- `supabase/functions/save-draft/index.ts`
- `supabase/functions/unpublish-event/index.ts`

### `supabase/migrations` (11)

- `supabase/migrations/20260403120000_complete_quiz_entitlements.sql`
- `supabase/migrations/20260405171549_fix_verification_code_pgcrypto_search_path.sql`
- `supabase/migrations/20260405175756_harden_completion_backend.sql`
- `supabase/migrations/20260406130000_add_published_quiz_content.sql`
- `supabase/migrations/20260406150000_add_quiz_authoring_drafts.sql`
- `supabase/migrations/20260407103000_add_quiz_authoring_auth.sql`
- `supabase/migrations/20260410170000_add_quiz_authoring_publish_workflow.sql`
- `supabase/migrations/20260415000000_add_quiz_event_draft_slug_lock_trigger.sql`
- `supabase/migrations/20260415010000_make_sponsor_nullable.sql`
- `supabase/migrations/20260416000000_add_quiz_starts.sql`
- `supabase/migrations/20260416010000_add_quiz_starts_event_fk.sql`

## Deep Audit Coverage

### Top 15 largest files (plus ties for trusted handlers)

| Lines | File |
| ---: | --- |
| 505 | `supabase/migrations/20260406130000_add_published_quiz_content.sql` |
| 443 | `apps/web/src/admin/useSelectedDraft.ts` |
| 441 | `apps/web/src/admin/AdminQuestionEditor.tsx` |
| 397 | `apps/web/src/admin/AdminEventWorkspace.tsx` |
| 330 | `supabase/migrations/20260410170000_add_quiz_authoring_publish_workflow.sql` |
| 321 | `apps/web/src/lib/gameApi.ts` |
| 306 | `apps/web/src/admin/useAdminDashboard.ts` |
| 284 | `apps/web/src/admin/questionStructure.ts` |
| 275 | `apps/web/src/game/gameSessionState.ts` |
| 263 | `supabase/functions/publish-draft/index.ts` |
| 256 | `shared/game-config/sample-games.ts` |
| 234 | `apps/web/src/lib/adminGameApi.ts` |
| 224 | `apps/web/src/admin/AdminEventDetailsForm.tsx` |
| 218 | `apps/web/src/game/useGameSession.ts` |
| 218 | `apps/web/src/admin/questionFormMapping.ts` |
| 212 | `supabase/functions/save-draft/index.ts` |
| 205 | `supabase/migrations/20260403120000_complete_quiz_entitlements.sql` |
| 205 | `supabase/functions/issue-session/index.ts` |
| 200 | `supabase/functions/complete-game/index.ts` |

### Additional boundary/orchestration modules audited

- `shared/game-config/index.ts`
- `apps/web/src/lib/gameContentApi.ts`
- `apps/web/src/lib/supabaseBrowser.ts`
- `supabase/functions/_shared/authoring-http.ts`
- `supabase/functions/_shared/admin-auth.ts`
- `supabase/functions/_shared/published-game-loader.ts`
- `supabase/functions/complete-game/dependencies.ts`
- `supabase/migrations/20260406150000_add_quiz_authoring_drafts.sql`
- `supabase/migrations/20260407103000_add_quiz_authoring_auth.sql`

## Gap Table

Summary counts:

- `Required`: 14
- `Optional`: 7
- `Noise`: 6

| Area | File/Symbol | Boundary Type | Current State | Required Change | Why Required | Suggested Slice |
| --- | --- | --- | --- | --- | --- | --- |
| Admin authoring | `apps/web/src/admin/AdminQuestionEditor.tsx` (file-level) | Large orchestration component | No file-level ownership header; many local transforms and save semantics | **Required:** add a short file-level responsibility header naming what this component owns vs delegates to `questionFormMapping.ts`/`questionStructure.ts` and API callbacks | File is large and orchestration-heavy; ownership is not obvious from filename alone | Slice A |
| Admin authoring | `apps/web/src/admin/questionStructure.ts` (file + exported transforms) | Shared question-structure seam | No file-level header; exported transforms lack contract comments for id generation/correctness fallback invariants | **Required:** add file-level header and concise exported-seam docs for invariants around id generation and `correctAnswerIds` normalization | This module encodes non-obvious correctness repair logic at a durable authoring boundary | Slice A |
| Admin authoring | `apps/web/src/admin/questionFormMapping.ts` (file + exported transforms) | Form-to-canonical mapping seam | No file-level header; exported save prep/mapping behavior undocumented | **Required:** add file-level header plus docs on exported mapping functions and failure behavior (required fields, option/correctness constraints) | Mapping and validation contracts are non-obvious and directly impact saved draft payload shape | Slice A |
| Admin authoring | `apps/web/src/admin/eventDetails.ts` (`createEventDetailsFormValues`, `applyEventDetailsFormValues`) | Event-detail canonicalization seam | No comments on exported mapping/validation contract | **Required:** document exported contract and failure behavior (trim/required validation + shared schema validation) | Exported seam writes canonical draft content before persistence | Slice A |
| Admin authoring | `apps/web/src/admin/AdminEventDetailsForm.tsx` (file-level) | Form orchestration component | Non-obvious slug-lock resync is documented inline, but file ownership is implicit | **Optional:** add file-level ownership header for consistency with other admin route-level files | Existing inline comments already explain highest-risk behavior | Slice A |
| Admin authoring | `apps/web/src/admin/useSelectedDraft.ts` | Hook orchestration | File-level hook doc exists and key non-obvious state-reset behavior is commented | **Noise:** no additional comment layer | Further comments would restate reducer/state transitions already readable in types and names | Slice A |
| Shared domain | `shared/game-config/index.ts` (file-level) | Public shared barrel boundary | No file-level boundary comment | **Required:** add short barrel contract header (what is exported, what is intentionally excluded, fixture boundary) | This is a public compatibility entrypoint with intentional omissions (`sample-fixtures`) | Slice B |
| Shared domain | `shared/game-config/sample-games.ts` (file-level) | Fixture boundary | Transitional inline note exists; no formal file-level responsibility header | **Optional:** convert/upgrade to file-level responsibility header for consistency | Current inline comment is adequate but less durable than a header | Slice B |
| Browser API | `apps/web/src/lib/gameApi.ts` (file-level) | Trust + fallback boundary | Rich symbol-level docs exist, but no file-level ownership header for remote vs local fallback responsibility | **Required:** add file-level responsibility header describing trusted backend path vs explicit local prototype fallback | Large boundary module with dual-path behavior; ownership split is critical for reviewers | Slice C |
| Browser API | `apps/web/src/lib/adminGameApi.ts` (file-level) | Admin auth/API boundary | Exported calls are documented, but no file-level summary of auth/session/postgrest/function-call responsibilities | **Required:** add file-level responsibility header | Durable API boundary for auth restoration, RPC access checks, and authoring function calls | Slice C |
| Browser API | `apps/web/src/lib/gameContentApi.ts` (file-level) | Published-content read boundary | Exported summary/content loaders documented; no file-level boundary summary | **Optional:** add a file-level header clarifying PostgREST read scope and fallback behavior | Symbol-level docs mostly cover behavior already | Slice C |
| Browser API | `apps/web/src/lib/supabaseBrowser.ts` | Shared runtime helper boundary | Exported symbols documented; responsibilities are understandable from names and type surface | **Noise:** no extra comments required | Additional comments would be repetitive | Slice C |
| Edge functions | `supabase/functions/_shared/authoring-http.ts` (file + exports) | Authenticated authoring HTTP boundary | No file-level header; exported dependencies/context and handler factory have no contract docs | **Required:** add file-level responsibility header and concise docs for `AuthoringHttpDependencies`, `AuthoringRequestContext`, and `createAuthoringPostHandler` | Trust boundary helper centralizes method/origin/auth/config checks for multiple write endpoints | Slice D |
| Edge functions | `supabase/functions/complete-game/dependencies.ts` (file + exports) | Trusted completion dependency boundary | No file-level header or seam docs | **Required:** add file-level boundary header and docs for dependency contract/default dependency source | Defines trusted dependency injection seam for completion handler correctness and tests | Slice D |
| Edge functions | `supabase/functions/issue-session/index.ts` and `supabase/functions/complete-game/index.ts` | Trust-path entrypoint handlers | Existing comments cover trust model, idempotency, and fallback behavior | **Noise:** no extra comments required | Already meets boundary documentation bar | Slice D |
| Migrations/RPC | `supabase/migrations/20260406130000_add_published_quiz_content.sql` (migration-level) | Published-content schema + RLS boundary | No migration-level header describing invariant intent and anonymous-read model | **Required:** add top-level migration responsibility header with trust/visibility invariants | Large durable DB boundary; reviewer intent is otherwise inferred from hundreds of lines | Slice E |
| Migrations/RPC | `supabase/migrations/20260403120000_complete_quiz_entitlements.sql` (`complete_game_and_award_entitlement`) | Completion idempotency + entitlement boundary | RPC has no explanatory comments for advisory lock and idempotent request behavior | **Required:** add concise comments for lock/idempotency/one-entitlement invariant | Non-obvious persistence safety model at core trust boundary | Slice E |
| Migrations/RPC | `supabase/migrations/20260406150000_add_quiz_authoring_drafts.sql` (migration-level) | Authoring tables + backfill boundary | No migration-level header for draft/version ownership and backfill rationale | **Required:** add migration-level responsibility header | Large migration with schema + backfill projection logic; intent is not obvious quickly | Slice E |
| Migrations/RPC | `supabase/migrations/20260407103000_add_quiz_authoring_auth.sql` (`is_admin`, helper functions) | Auth/RLS boundary | No comments describing security-definer helper intent and claim resolution model | **Required:** add concise comments at function boundaries | Durable auth boundary semantics are non-obvious without comments | Slice E |
| Migrations/RPC | `supabase/migrations/20260410170000_add_quiz_authoring_publish_workflow.sql` | Publish workflow boundary | Already includes meaningful comments for key invariants (draft lock, normalized writes, slug lock) | **Optional:** keep as-is; add only if future behavior changes | Current documentation is adequate at highest-risk points | Slice E |
| UI leaf modules | `apps/web/src/game/components/*.tsx` | Presentational leaf components | Existing concise headers and prop docs already present | **Noise:** do not add per-prop or control-flow comments beyond current level | Would restate obvious JSX/props and add maintenance noise | Slice A |
| Shared types | `shared/game-config/types.ts` | Canonical type boundary | Types already carry concise TSDoc on each domain type | **Noise:** no additional comments | Already matches standard | Slice B |

## Required Vs Noise Decisions

`Required` work concentrates on:

- file-level ownership headers for large route/orchestration/boundary modules
- exported seams at durable trust/persistence/API boundaries
- SQL migration/RPC intent where invariants are non-obvious

`Noise` exclusions for follow-up PRs:

- do not add blanket TSDoc to every local helper in leaf UI modules
- do not add comments that repeat type names, obvious control flow, or simple JSX
- do not annotate every SQL constraint line-by-line when one migration-level or
  function-level invariant comment is sufficient
- do not add phase/todo tracking comments in source files

## Remediation Slices

### Slice A — Admin orchestration and form modules

Scope:

- `apps/web/src/admin/AdminQuestionEditor.tsx`
- `apps/web/src/admin/questionStructure.ts`
- `apps/web/src/admin/questionFormMapping.ts`
- `apps/web/src/admin/eventDetails.ts`
- optional consistency polish: `apps/web/src/admin/AdminEventDetailsForm.tsx`

Validation:

```bash
npm run lint
npm run build:web
```

### Slice B — Shared domain exports and barrel clarity

Scope:

- `shared/game-config/index.ts`
- optional consistency polish: `shared/game-config/sample-games.ts`

Validation:

```bash
npm run lint
npm run build:web
```

### Slice C — Browser API boundary helpers

Scope:

- `apps/web/src/lib/gameApi.ts`
- `apps/web/src/lib/adminGameApi.ts`
- optional consistency polish: `apps/web/src/lib/gameContentApi.ts`

Validation:

```bash
npm run lint
npm run build:web
```

### Slice D — Edge Function boundary helpers and handler dependencies

Scope:

- `supabase/functions/_shared/authoring-http.ts`
- `supabase/functions/complete-game/dependencies.ts`

Validation:

```bash
npm run lint
deno check --no-lock supabase/functions/issue-session/index.ts
deno check --no-lock supabase/functions/complete-game/index.ts
deno check --no-lock supabase/functions/save-draft/index.ts
deno check --no-lock supabase/functions/publish-draft/index.ts
deno check --no-lock supabase/functions/unpublish-event/index.ts
```

### Slice E — Migration/RPC invariant comments

Scope:

- `supabase/migrations/20260406130000_add_published_quiz_content.sql`
- `supabase/migrations/20260403120000_complete_quiz_entitlements.sql`
- `supabase/migrations/20260406150000_add_quiz_authoring_drafts.sql`
- `supabase/migrations/20260407103000_add_quiz_authoring_auth.sql`

Validation:

```bash
npm run test:db
```

If combined with broader backend change scope in the same PR:

```bash
npm run test:supabase
```

## Audit Completion Checklist

- [x] All scoped directories inventoried
- [x] Top ~15 largest files and boundary/orchestration modules deep-audited
- [x] Findings classified as Required/Optional/Noise with rationale
- [x] Remediation sliced into PR-sized follow-ups with validation commands
- [x] Tracker docs updated to point to this artifact
