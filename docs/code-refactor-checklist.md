# Code Refactor Checklist

## Purpose

Track small, non-functional refactor tasks for files that have grown large
enough that splitting them would improve reviewability and local ownership.

Rules for this checklist:

- keep each task behavior-preserving
- move tests with the code they cover
- run the existing validation command for the touched area
- avoid mixing these cleanups with product or schema behavior changes
- add a task only when the issue was observed while implementing or reviewing
  real work
- name the exact file or module, the concrete responsibility problem, the
  desired target shape, and the minimum validation command
- keep each task small enough for one focused PR
- do not add tasks for cosmetic preferences, speculative abstraction, or general
  cleanup without clear reviewability, correctness, ownership, duplication, or
  future-change-cost value
- styling refactor tasks should prefer semantic tokens, avoid tokenizing one-off
  layout values, and include compiled CSS comparison in validation when practical

## Candidate Tasks

- [x] Split authoring Edge Function tests by endpoint.
  `tests/supabase/functions/authoring.test.ts` is over 400 lines and now covers
  three independent handlers. Move coverage into focused files such as
  `save-draft.test.ts`, `publish-draft.test.ts`, and `unpublish-event.test.ts`
  while keeping shared test fixtures in a small helper.
  Validation: `npm run test:functions`.

- [x] Split the Phase 3 database publish pgTAP coverage by behavior.
  Replaced `supabase/tests/database/quiz_authoring_phase3_publish.test.sql`
  with smaller `.test.sql` files grouped by publish projection/version
  behavior, unpublish/audit behavior, and failure/permission behavior.
  Validation: `npm run test:db`.

- [x] Extract shared authoring Edge Function HTTP/auth boilerplate.
  `supabase/functions/save-draft/index.ts`,
  `supabase/functions/publish-draft/index.ts`, and
  `supabase/functions/unpublish-event/index.ts` repeat CORS, method,
  configuration, admin-auth, JSON response, and persistence-error mapping
  patterns. Add a small shared helper under `supabase/functions/_shared/` so
  each endpoint file mostly owns payload validation and its persistence call.
  Validation: `npm run test:functions` plus `deno check --no-lock` for the three
  authoring functions.

- [x] Split the admin page shell into state and presentation pieces.
  `apps/web/src/pages/AdminPage.tsx` now stays a thin route adapter. Admin
  session orchestration, dashboard loading, magic-link form state, sign-out
  state, status rendering, and draft-list presentation live in focused modules
  under `apps/web/src/admin/`.
  Validation: `npm test -- tests/web/pages/AdminPage.test.tsx` and
  `npm run build:web`.

- [ ] Split authoring draft parsing primitives from draft mapping.
  `shared/game-config/draft-content.ts` contains JSON parsing primitives,
  question/option parsing, draft row types, validation, and draft-to-runtime
  mapping. Move generic JSON expectation helpers and question parsing into
  focused shared modules so `draft-content.ts` reads as the public authoring
  contract.
  Validation: `npm test -- tests/shared/game-config/draft-content.test.ts` and
  `npm run build:web`.

- [ ] Split browser quiz API local fallback from Supabase transport.
  `apps/web/src/lib/quizApi.ts` owns local prototype entitlement storage,
  server-session bootstrap, completion submission, retry handling, and response
  mapping. Extract local fallback storage/completion into a separate module so
  the production Supabase path is easier to review.
  Validation: `npm test -- tests/web/lib/quizApi.test.ts` and
  `npm run build:web`.

- [x] Split quiz SCSS by component group.
  `apps/web/src/styles/_quiz.scss` now stays a quiz style index partial.
  Focused quiz partials own panel, control, progress, shared flow layout,
  question/option, feedback, question-action, result/review, completion-token,
  focus, and motion styles.
  Validation: `npm run build:web`.

- [x] Consolidate repeated SCSS color and spacing literals into semantic tokens.
  `apps/web/src/styles/_tokens.scss` now owns repeated surface, border, state,
  focus, glow, spacing, font-weight, and shared component-size roles. Component
  partials use those tokens where they improve readability, while one-off layout
  values remain local.
  Validation: `npm run build:web` plus compiled CSS comparison before/after.

- [x] Split local Edge Function integration runner by responsibility.
  Extracted process lifecycle, readiness polling, completion retry, and JSON
  HTTP diagnostics into `scripts/testing/` utilities so
  `scripts/testing/run-function-integration-tests.cjs` reads as the trusted
  Edge Function scenario being tested.
  Validation: `npm run test:functions:integration`.

- [x] Split `complete-quiz` handler utilities from request orchestration.
  `supabase/functions/complete-quiz/index.ts` is over 300 lines and includes
  persistence types, payload validation, JSON response helpers, and the full
  handler. Move reusable response/payload/persistence helpers into local or
  shared modules without changing the public function contract.
  Extracted local `dependencies.ts`, `payload.ts`, `persistence.ts`, and
  `response.ts` modules so `index.ts` now stays focused on request
  orchestration and compatibility exports. The handler entrypoint dropped from
  325 lines to 200 lines without changing response bodies, status codes, RPC
  parameters, or validation behavior.
  Validation: `npm run test:functions` and
  `deno check --no-lock supabase/functions/complete-quiz/index.ts`.

## Large Files To Leave Alone For Now

- `supabase/migrations/20260406130000_add_published_quiz_content.sql` is large
  because it includes historical seed data. Do not split an already-applied
  migration just to reduce line count.
- `shared/game-config/sample-games.ts` is mostly explicit sample content. Split
  it only when adding or reorganizing sample fixtures for a concrete reason.
